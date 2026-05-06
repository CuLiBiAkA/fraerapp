package com.fraergod.fraerapp.game;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;

@Service
class GameService {

	private static final String LOCAL_VARIABLES_KEY = "__sceneVariables";
	private static final Pattern VARIABLE_PLACEHOLDER = Pattern.compile("\\{\\{\\s*([^{}\\s]+)\\s*}}");

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
		return createSession(playerId, storyKey, null);
	}

	@Transactional
	SessionState createSession(String playerId, String storyKey, String saveName) {
		Player player = player(playerId);
		Story story = stories.findByKey(storyKey)
				.filter(candidate -> candidate.getStatus() == StoryStatus.PUBLISHED)
				.orElseThrow(StoryNotFoundException::new);
		String resolvedSaveName = blank(saveName)
				? "Save " + (sessions.countByPlayerIdAndStoryId(player.getId(), story.getId()) + 1)
				: saveName;
		GameSession session = sessions.save(new GameSession(player.getId(), story, resolvedSaveName));
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
	List<SaveSummary> sessionSaves(String playerId) {
		Player player = player(playerId);
		return sessions.findByPlayerIdOrderByUpdatedAtDesc(player.getId()).stream()
				.map(this::saveSummary)
				.toList();
	}

	@Transactional(readOnly = true)
	List<SaveSummary> storySaves(String playerId, String storyKey) {
		Player player = player(playerId);
		Story story = stories.findByKey(storyKey)
				.filter(candidate -> candidate.getStatus() == StoryStatus.PUBLISHED)
				.orElseThrow(StoryNotFoundException::new);
		return sessions.findByPlayerIdAndStoryIdOrderByUpdatedAtDesc(player.getId(), story.getId()).stream()
				.map(session -> saveSummary(session, story))
				.toList();
	}

	@Transactional
	SaveSummary renameSave(String playerId, String sessionId, String saveName) {
		GameSession session = session(playerId, sessionId);
		session.rename(saveName);
		return saveSummary(session);
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

		applyEffects(sceneVariables, selected.getEffectsJson());
		persistGlobalVariables(variables, sceneVariables, current);
		boolean conditionsPassed = conditionsPass(sceneVariables, selected.getConditionsJson());
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
				interpolateText(scene.getText(), sceneVariables),
				background == null ? localAssetUrls.get(scene.getBackgroundAssetId()) : background.getUrl(),
				music == null ? localAssetUrls.get(scene.getMusicAssetId()) : music.getUrl(),
				json.readObject(scene.getAnimationJson()),
				json.readObject(scene.getEndingJson()),
				runtimeChoices);
		return new SessionState(
				session.getId(),
				new RuntimeStory(story.getKey(), story.getTitle(), playerName(story.getOwnerPlayerId())),
				runtimeScene,
				publicVariables(variables),
				statsVariables(story, variables),
				session.getStatus().name().toLowerCase());
	}

	private SaveSummary saveSummary(GameSession session) {
		return saveSummary(session, story(session.getStoryId()));
	}

	private SaveSummary saveSummary(GameSession session, Story story) {
		Scene current = scene(story, session.getCurrentSceneKey());
		return new SaveSummary(
				session.getId(),
				session.getSaveName(),
				story.getKey(),
				story.getTitle(),
				playerName(story.getOwnerPlayerId()),
				current.getSceneKey(),
				current.getTitle(),
				progress(story.getId(), session),
				session.getStatus().name().toLowerCase(),
				session.getCreatedAt(),
				session.getUpdatedAt());
	}

	private double progress(String storyId, GameSession session) {
		if (session.getStatus() == SessionStatus.FINISHED) {
			return 100.0;
		}
		List<Scene> storyScenes = scenes.findByStoryIdOrderByOrderIndexAsc(storyId);
		if (storyScenes.isEmpty()) {
			return 0.0;
		}
		for (int index = 0; index < storyScenes.size(); index++) {
			if (storyScenes.get(index).getSceneKey().equals(session.getCurrentSceneKey())) {
				return ((index + 1) * 100.0) / storyScenes.size();
			}
		}
		return 0.0;
	}

	private Map<String, Object> publicVariables(Map<String, Object> variables) {
		Map<String, Object> visible = new java.util.LinkedHashMap<>(variables);
		visible.remove(LOCAL_VARIABLES_KEY);
		return visible;
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
		context.remove(LOCAL_VARIABLES_KEY);
		Map<String, Object> localDefaults = json.readMap(scene.getLocalVariablesJson());
		context.putAll(localDefaults);
		context.putAll(savedLocalVariables(globalVariables, scene.getSceneKey(), localDefaults.keySet()));
		return context;
	}

	private void persistGlobalVariables(Map<String, Object> globalVariables, Map<String, Object> sceneVariables, Scene scene) {
		Set<String> localNames = json.readMap(scene.getLocalVariablesJson()).keySet();
		Map<String, Object> locals = savedLocalVariables(globalVariables, scene.getSceneKey(), localNames);
		for (Map.Entry<String, Object> entry : sceneVariables.entrySet()) {
			if (localNames.contains(entry.getKey())) {
				locals.put(entry.getKey(), entry.getValue());
			} else if (!LOCAL_VARIABLES_KEY.equals(entry.getKey())) {
				globalVariables.put(entry.getKey(), entry.getValue());
			}
		}
		storeLocalVariables(globalVariables, scene.getSceneKey(), locals);
	}

	@SuppressWarnings("unchecked")
	private Map<String, Object> savedLocalVariables(Map<String, Object> globalVariables, String sceneKey, Set<String> localNames) {
		Object allLocals = globalVariables.get(LOCAL_VARIABLES_KEY);
		if (!(allLocals instanceof Map<?, ?> localByScene)) {
			return new java.util.LinkedHashMap<>();
		}
		Object sceneLocals = localByScene.get(sceneKey);
		if (!(sceneLocals instanceof Map<?, ?> rawLocals)) {
			return new java.util.LinkedHashMap<>();
		}
		Map<String, Object> locals = new java.util.LinkedHashMap<>();
		rawLocals.forEach((key, value) -> {
			String name = String.valueOf(key);
			if (localNames.contains(name)) {
				locals.put(name, value);
			}
		});
		return locals;
	}

	@SuppressWarnings("unchecked")
	private void storeLocalVariables(Map<String, Object> globalVariables, String sceneKey, Map<String, Object> locals) {
		Object allLocals = globalVariables.get(LOCAL_VARIABLES_KEY);
		Map<String, Object> localByScene = allLocals instanceof Map<?, ?> raw
				? new java.util.LinkedHashMap<>((Map<String, Object>) raw)
				: new java.util.LinkedHashMap<>();
		if (locals.isEmpty()) {
			localByScene.remove(sceneKey);
		} else {
			localByScene.put(sceneKey, new java.util.LinkedHashMap<>(locals));
		}
		if (localByScene.isEmpty()) {
			globalVariables.remove(LOCAL_VARIABLES_KEY);
		} else {
			globalVariables.put(LOCAL_VARIABLES_KEY, localByScene);
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

	private String interpolateText(String text, Map<String, Object> variables) {
		if (text == null || text.isBlank()) {
			return text == null ? "" : text;
		}
		Matcher matcher = VARIABLE_PLACEHOLDER.matcher(text);
		StringBuffer result = new StringBuffer();
		while (matcher.find()) {
			Object value = variables.get(matcher.group(1));
			matcher.appendReplacement(result, Matcher.quoteReplacement(formatTextVariable(value)));
		}
		matcher.appendTail(result);
		return result.toString();
	}

	private String formatTextVariable(Object value) {
		if (value == null) {
			return "";
		}
		if (value instanceof Double number && Math.rint(number) == number) {
			return String.valueOf(number.longValue());
		}
		if (value instanceof Float number && Math.rint(number) == number) {
			return String.valueOf(number.longValue());
		}
		if (value instanceof Map<?, ?> || value instanceof List<?>) {
			return json.write(value);
		}
		return String.valueOf(value);
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

	record SaveSummary(
			String sessionId,
			String saveName,
			String storyKey,
			String storyTitle,
			String authorName,
			String sceneId,
			String sceneTitle,
			double completionRate,
			String status,
			Instant createdAt,
			Instant updatedAt) {
	}
}
