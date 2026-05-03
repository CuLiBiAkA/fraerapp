package com.fraergod.fraerapp.game;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;

@Service
class GameService {

	private final PlayerRepository players;
	private final StoryRepository stories;
	private final SceneRepository scenes;
	private final ChoiceRepository choices;
	private final StoryAssetRepository assets;
	private final GameSessionRepository sessions;
	private final JsonSupport json;

	GameService(PlayerRepository players, StoryRepository stories, SceneRepository scenes, ChoiceRepository choices,
			StoryAssetRepository assets, GameSessionRepository sessions, JsonSupport json) {
		this.players = players;
		this.stories = stories;
		this.scenes = scenes;
		this.choices = choices;
		this.assets = assets;
		this.sessions = sessions;
		this.json = json;
	}

	@Transactional
	Player login(String username) {
		String normalized = username.trim();
		return players.findByUsernameIgnoreCase(normalized)
				.orElseGet(() -> players.save(new Player(normalized, "legacy")));
	}

	@Transactional(readOnly = true)
	List<StorySummary> publishedStories() {
		return stories.findByStatusOrderByTitleAsc(StoryStatus.PUBLISHED).stream()
				.map(story -> new StorySummary(story.getKey(), story.getTitle(), story.getDescription()))
				.toList();
	}

	@Transactional
	SessionState createSession(String playerId, String storyKey) {
		Player player = player(playerId);
		Story story = stories.findByKey(storyKey)
				.filter(candidate -> candidate.getStatus() == StoryStatus.PUBLISHED)
				.orElseThrow(StoryNotFoundException::new);
		GameSession session = sessions.save(new GameSession(player.getId(), story));
		Scene start = scene(story, story.getStartSceneId());
		Map<String, Object> variables = json.readMap(session.getVariablesJson());
		applySceneEffects(variables, start);
		session.setVariablesJson(json.write(variables));
		if (json.readObject(start.getEndingJson()) != null) {
			session.finish(start.getSceneKey());
		}
		return state(session, story, start);
	}

	@Transactional(readOnly = true)
	SessionState sessionState(String playerId, String sessionId) {
		GameSession session = session(playerId, sessionId);
		Story story = story(session.getStoryId());
		return state(session, story, scene(story, session.getCurrentSceneKey()));
	}

	@Transactional
	SessionState choose(String playerId, String sessionId, String choiceId) {
		GameSession session = session(playerId, sessionId);
		if (session.getStatus() == SessionStatus.FINISHED) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Session is finished");
		}
		Story story = story(session.getStoryId());
		Scene current = scene(story, session.getCurrentSceneKey());
		Map<String, Object> variables = json.readMap(session.getVariablesJson());
		Map<String, Object> sceneVariables = sceneVariables(current, variables);
		Choice selected = availableChoices(current, sceneVariables).stream()
				.filter(choice -> choice.getChoiceKey().equals(choiceId))
				.findFirst()
				.orElseThrow(InvalidChoiceException::new);

		boolean conditionsPassed = conditionsPass(sceneVariables, selected.getConditionsJson());
		if (conditionsPassed) {
			applyEffects(sceneVariables, selected.getEffectsJson());
			persistGlobalVariables(variables, sceneVariables, current);
		}
		String targetSceneKey = conditionsPassed || blank(selected.getFallbackTargetSceneKey())
				? selected.getTargetSceneKey()
				: selected.getFallbackTargetSceneKey();
		Scene next = scene(story, targetSceneKey);
		applySceneEffects(variables, next);
		session.setVariablesJson(json.write(variables));
		session.setCurrentSceneKey(next.getSceneKey());
		if (json.readObject(next.getEndingJson()) != null) {
			session.finish(next.getSceneKey());
		}
		return state(session, story, next);
	}

	@Transactional
	SessionState reset(String playerId, String sessionId) {
		GameSession session = session(playerId, sessionId);
		Story story = story(session.getStoryId());
		session.reset(story);
		Scene start = scene(story, story.getStartSceneId());
		Map<String, Object> variables = json.readMap(session.getVariablesJson());
		applySceneEffects(variables, start);
		session.setVariablesJson(json.write(variables));
		return state(session, story, start);
	}

	private Player player(String playerId) {
		if (playerId == null || playerId.isBlank()) {
			throw new PlayerNotFoundException();
		}
		return players.findById(playerId).orElseThrow(PlayerNotFoundException::new);
	}

	private GameSession session(String playerId, String sessionId) {
		if (sessionId == null || sessionId.isBlank()) {
			throw new SessionNotFoundException();
		}
		GameSession session = sessions.findById(sessionId).orElseThrow(SessionNotFoundException::new);
		if (!session.getPlayerId().equals(player(playerId).getId())) {
			throw new ForbiddenSessionException();
		}
		return session;
	}

	private Story story(String storyId) {
		return stories.findById(storyId).orElseThrow(StoryNotFoundException::new);
	}

	private Scene scene(Story story, String sceneKey) {
		return scenes.findByStoryIdAndSceneKey(story.getId(), sceneKey).orElseThrow(StoryConfigurationException::new);
	}

	private SessionState state(GameSession session, Story story, Scene scene) {
		Map<String, Object> variables = json.readMap(session.getVariablesJson());
		Map<String, StoryAsset> assetByKey = assets.findByStoryId(story.getId()).stream()
				.collect(java.util.stream.Collectors.toMap(StoryAsset::getAssetKey, asset -> asset));
		Map<String, String> localAssetUrls = localAssetUrls(scene);
		Map<String, Object> sceneVariables = sceneVariables(scene, variables);
		List<RuntimeChoice> runtimeChoices = availableChoices(scene, sceneVariables).stream()
				.sorted(Comparator.comparing(Choice::getChoiceKey))
				.map(choice -> new RuntimeChoice(choice.getChoiceKey(), choice.getLabel(),
						conditionsPass(sceneVariables, choice.getConditionsJson()),
						blank(choice.getFallbackTargetSceneKey()) ? null : choice.getFallbackTargetSceneKey()))
				.toList();
		StoryAsset background = assetByKey.get(scene.getBackgroundAssetId());
		StoryAsset music = assetByKey.get(scene.getMusicAssetId());
		RuntimeScene runtimeScene = new RuntimeScene(
				scene.getSceneKey(),
				scene.getTitle(),
				scene.getText(),
				background == null ? localAssetUrls.get(scene.getBackgroundAssetId()) : background.getUrl(),
				music == null ? localAssetUrls.get(scene.getMusicAssetId()) : music.getUrl(),
				json.readObject(scene.getAnimationJson()),
				json.readObject(scene.getEndingJson()),
				runtimeChoices);
		return new SessionState(
				session.getId(),
				new RuntimeStory(story.getKey(), story.getTitle(), playerName(story.getOwnerPlayerId())),
				runtimeScene,
				variables,
				statsVariables(story, variables),
				session.getStatus().name().toLowerCase());
	}

	private Map<String, Object> statsVariables(Story story, Map<String, Object> variables) {
		Map<String, Object> visible = new java.util.LinkedHashMap<>();
		for (String name : json.readStringList(story.getStatsVariablesJson())) {
			if (variables.containsKey(name)) {
				visible.put(name, variables.get(name));
			}
		}
		return visible;
	}

	private List<Choice> availableChoices(Scene scene, Map<String, Object> variables) {
		List<Choice> result = new ArrayList<>();
		for (Choice choice : choices.findBySceneIdOrderByOrderIndexAsc(scene.getId())) {
			if (conditionsPass(variables, choice.getConditionsJson()) || !blank(choice.getFallbackTargetSceneKey())) {
				result.add(choice);
			}
		}
		return result;
	}

	private Map<String, Object> sceneVariables(Scene scene, Map<String, Object> globalVariables) {
		Map<String, Object> context = new java.util.LinkedHashMap<>(globalVariables);
		context.putAll(json.readMap(scene.getLocalVariablesJson()));
		return context;
	}

	private void persistGlobalVariables(Map<String, Object> globalVariables, Map<String, Object> sceneVariables, Scene scene) {
		Set<String> localNames = json.readMap(scene.getLocalVariablesJson()).keySet();
		for (Map.Entry<String, Object> entry : sceneVariables.entrySet()) {
			if (!localNames.contains(entry.getKey())) {
				globalVariables.put(entry.getKey(), entry.getValue());
			}
		}
	}

	private void applySceneEffects(Map<String, Object> globalVariables, Scene scene) {
		Map<String, Object> context = sceneVariables(scene, globalVariables);
		applyEffects(context, scene.getEffectsJson());
		persistGlobalVariables(globalVariables, context, scene);
	}

	private Map<String, String> localAssetUrls(Scene scene) {
		Map<String, String> urls = new java.util.LinkedHashMap<>();
		for (JsonNode asset : json.readNodeList(scene.getLocalAssetsJson())) {
			if (asset.hasNonNull("id") && asset.hasNonNull("url")) {
				urls.put(asset.get("id").asText(), asset.get("url").asText());
			}
		}
		return urls;
	}

	private boolean conditionsPass(Map<String, Object> variables, String conditionsJson) {
		for (JsonNode condition : json.readNodeList(conditionsJson)) {
			String variable = text(condition, "var");
			String op = text(condition, "op");
			JsonNode expectedNode = condition.get("value");
			Object actual = variables.get(variable);
			Object expected = expectedNode == null ? null : json.valueToNode(expectedNode).isNull() ? null : nodeValue(expectedNode);
			if (!compare(actual, op, expected)) {
				return false;
			}
		}
		return true;
	}

	private boolean compare(Object actual, String op, Object expected) {
		return switch (op) {
			case "==" -> java.util.Objects.equals(actual, expected);
			case "!=" -> !java.util.Objects.equals(actual, expected);
			case ">", ">=", "<", "<=" -> compareNumbers(actual, op, expected);
			default -> false;
		};
	}

	private boolean compareNumbers(Object actual, String op, Object expected) {
		if (!(actual instanceof Number actualNumber) || !(expected instanceof Number expectedNumber)) {
			return false;
		}
		double left = actualNumber.doubleValue();
		double right = expectedNumber.doubleValue();
		return switch (op) {
			case ">" -> left > right;
			case ">=" -> left >= right;
			case "<" -> left < right;
			case "<=" -> left <= right;
			default -> false;
		};
	}

	private void applyEffects(Map<String, Object> variables, String effectsJson) {
		for (JsonNode effect : json.readNodeList(effectsJson)) {
			if (effect.has("set")) {
				variables.put(effect.get("set").asText(), nodeValue(effect.get("value")));
			}
			if (effect.has("inc")) {
				String key = effect.get("inc").asText();
				double current = variables.get(key) instanceof Number number ? number.doubleValue() : 0;
				double delta = effect.has("value") && effect.get("value").isNumber() ? effect.get("value").doubleValue() : 1;
				double next = current + delta;
				variables.put(key, Math.rint(next) == next ? (int) next : next);
			}
		}
	}

	private Object nodeValue(JsonNode node) {
		if (node == null || node.isNull()) {
			return null;
		}
		if (node.isBoolean()) {
			return node.asBoolean();
		}
		if (node.isInt() || node.isLong()) {
			return node.asLong();
		}
		if (node.isNumber()) {
			return node.asDouble();
		}
		if (node.isTextual()) {
			return node.asText();
		}
		return json.readObject(node.toString());
	}

	private String text(JsonNode node, String field) {
		return node.hasNonNull(field) ? node.get(field).asText() : "";
	}

	private boolean blank(String value) {
		return value == null || value.isBlank();
	}

	private String playerName(String playerId) {
		if (playerId == null || playerId.isBlank()) {
			return "System";
		}
		return players.findById(playerId).map(Player::getUsername).orElse("Unknown");
	}

	record StorySummary(String key, String title, String description) {
	}

	record RuntimeStory(String key, String title, String authorName) {
	}

	record RuntimeChoice(String id, String label, boolean conditionsPassed, String fallbackTarget) {
	}

	record RuntimeScene(
			String id,
			String title,
			String text,
			String backgroundUrl,
			String musicUrl,
			Object animation,
			Object ending,
			List<RuntimeChoice> choices) {
	}

	record SessionState(String sessionId, RuntimeStory story, RuntimeScene scene, Map<String, Object> variables,
			Map<String, Object> statsVariables, String status) {
	}
}
