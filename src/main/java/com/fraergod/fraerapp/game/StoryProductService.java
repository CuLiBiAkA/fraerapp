package com.fraergod.fraerapp.game;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class StoryProductService {

	private final PlayerRepository players;
	private final StoryRepository stories;
	private final SceneRepository scenes;
	private final ChoiceRepository choices;
	private final StoryAssetRepository assets;
	private final GameSessionRepository sessions;
	private final JsonSupport json;
	private final StoryAdminService admin;

	StoryProductService(PlayerRepository players, StoryRepository stories, SceneRepository scenes, ChoiceRepository choices,
			StoryAssetRepository assets, GameSessionRepository sessions, JsonSupport json, StoryAdminService admin) {
		this.players = players;
		this.stories = stories;
		this.scenes = scenes;
		this.choices = choices;
		this.assets = assets;
		this.sessions = sessions;
		this.json = json;
		this.admin = admin;
	}

	@Transactional(readOnly = true)
	List<AuthorStorySummary> authoredStories(String playerId) {
		player(playerId);
		return stories.findByOwnerPlayerIdOrderByUpdatedAtDesc(playerId).stream()
				.map(story -> new AuthorStorySummary(
						story.getId(),
						story.getKey(),
						story.getTitle(),
						story.getDescription(),
						story.getStatus().name().toLowerCase(),
						story.getPublishedSlug(),
						story.getPublishedAt(),
						sessions.countByStoryId(story.getId()),
						sessions.countByStoryIdAndStatus(story.getId(), SessionStatus.FINISHED)))
				.toList();
	}

	@Transactional
	StoryAdminService.ImportResponse importForAuthor(String playerId, String body) {
		player(playerId);
		return admin.importStory(body, playerId);
	}

	@Transactional
	StoryAdminService.ImportResponse publishForAuthor(String playerId, String storyId) {
		player(playerId);
		Story story = ownedStory(playerId, storyId);
		return admin.publish(story.getId(), playerId);
	}

	@Transactional(readOnly = true)
	AuthorStoryDetails authoredStory(String playerId, String storyId) {
		Story story = ownedStory(playerId, storyId);
		return new AuthorStoryDetails(
				story.getId(),
				story.getKey(),
				story.getTitle(),
				story.getDescription(),
				story.getStatus().name().toLowerCase(),
				story.getPublishedSlug(),
				story.getPublishedAt(),
				sessions.countByStoryId(story.getId()),
				sessions.countByStoryIdAndStatus(story.getId(), SessionStatus.FINISHED));
	}

	@Transactional(readOnly = true)
	Map<String, Object> authoredStoryDocument(String playerId, String storyId) {
		Story story = ownedStory(playerId, storyId);
		Map<String, Object> document = new java.util.LinkedHashMap<>();
		document.put("key", story.getKey());
		document.put("title", story.getTitle());
		document.put("description", story.getDescription());
		document.put("version", story.getVersion());
		document.put("startSceneId", story.getStartSceneId());
		document.put("variables", exportVariables(story));
		document.put("assets", assets.findByStoryId(story.getId()).stream()
				.map(asset -> {
					Map<String, Object> item = new java.util.LinkedHashMap<>();
					item.put("id", asset.getAssetKey());
					item.put("type", asset.getType());
					item.put("url", asset.getUrl());
					Object metadata = json.readObject(asset.getMetadataJson());
					if (metadata != null) {
						item.put("metadata", metadata);
					}
					return item;
				})
				.toList());
		document.put("scenes", scenes.findByStoryIdOrderByOrderIndexAsc(story.getId()).stream()
				.map(scene -> {
					Map<String, Object> item = new java.util.LinkedHashMap<>();
					item.put("id", scene.getSceneKey());
					item.put("title", scene.getTitle());
					item.put("text", scene.getText());
					item.put("background", scene.getBackgroundAssetId());
					item.put("music", scene.getMusicAssetId());
					item.put("animation", emptyMapIfNull(json.readObject(scene.getAnimationJson())));
					item.put("effects", json.readNodeList(scene.getEffectsJson()));
					Object ending = json.readObject(scene.getEndingJson());
					if (ending != null) {
						item.put("ending", ending);
					}
					item.put("choices", choices.findBySceneIdOrderByOrderIndexAsc(scene.getId()).stream()
							.map(choice -> {
								Map<String, Object> choiceItem = new java.util.LinkedHashMap<>();
								choiceItem.put("id", choice.getChoiceKey());
								choiceItem.put("label", choice.getLabel());
								choiceItem.put("target", choice.getTargetSceneKey());
								choiceItem.put("conditions", json.readNodeList(choice.getConditionsJson()));
								choiceItem.put("effects", json.readNodeList(choice.getEffectsJson()));
								return choiceItem;
							})
							.toList());
					return item;
				})
				.toList());
		return document;
	}

	@Transactional(readOnly = true)
	StoryAnalytics analytics(String playerId, String storyId) {
		Story story = ownedStory(playerId, storyId);
		long totalSessions = sessions.countByStoryId(story.getId());
		long finishedSessions = sessions.countByStoryIdAndStatus(story.getId(), SessionStatus.FINISHED);
		List<RecentSession> recent = sessions.findTop20ByStoryIdOrderByUpdatedAtDesc(story.getId()).stream()
				.map(session -> new RecentSession(
						session.getId(),
						session.getPlayerId(),
						playerName(session.getPlayerId()),
						session.getStatus().name().toLowerCase(),
						session.getCurrentSceneKey(),
						session.getEndingSceneKey(),
						session.getUpdatedAt()))
				.toList();
		return new StoryAnalytics(
				story.getId(),
				story.getTitle(),
				totalSessions,
				finishedSessions,
				totalSessions == 0 ? 0.0 : (finishedSessions * 100.0) / totalSessions,
				recent);
	}

	@Transactional(readOnly = true)
	StoryValidationResult validateForAuthor(String playerId, String storyId) {
		ownedStory(playerId, storyId);
		return admin.validateStory(storyId);
	}

	@Transactional(readOnly = true)
	List<PublishedStorySummary> publishedCatalog(String playerId) {
		Map<String, GameSession> lastSessionByStoryId = lastSessionByStoryId(playerId);
		return stories.findByStatusAndPublishedSlugIsNotNullOrderByPublishedAtDesc(StoryStatus.PUBLISHED).stream()
				.map(story -> {
					long totalRuns = sessions.countByStoryId(story.getId());
					long finishedRuns = sessions.countByStoryIdAndStatus(story.getId(), SessionStatus.FINISHED);
					GameSession lastSession = lastSessionByStoryId.get(story.getId());
					return new PublishedStorySummary(
						story.getPublishedSlug(),
						story.getKey(),
						story.getTitle(),
						story.getDescription(),
						playerName(story.getOwnerPlayerId()),
						totalRuns,
						finishedRuns,
						storyProgress(story.getId(), lastSession),
						story.getPublishedAt(),
						story.getUpdatedAt(),
						lastSession == null ? null : lastSession.getUpdatedAt());
				})
				.toList();
	}

	@Transactional(readOnly = true)
	PublishedStoryDetails publishedStory(String slug) {
		Story story = stories.findByPublishedSlug(slug)
				.filter(candidate -> candidate.getStatus() == StoryStatus.PUBLISHED)
				.orElseThrow(StoryNotFoundException::new);
		return new PublishedStoryDetails(
				story.getPublishedSlug(),
				story.getKey(),
				story.getTitle(),
				story.getDescription(),
				playerName(story.getOwnerPlayerId()),
				sessions.countByStoryId(story.getId()),
				sessions.countByStoryIdAndStatus(story.getId(), SessionStatus.FINISHED),
				story.getPublishedAt(),
				story.getUpdatedAt());
	}

	private Map<String, GameSession> lastSessionByStoryId(String playerId) {
		if (playerId == null || playerId.isBlank() || !players.existsById(playerId)) {
			return Map.of();
		}
		return sessions.findByPlayerIdOrderByUpdatedAtDesc(playerId).stream()
				.collect(java.util.stream.Collectors.toMap(
						GameSession::getStoryId,
						session -> session,
						(first, ignored) -> first));
	}

	private double storyProgress(String storyId, GameSession session) {
		if (session == null) {
			return 0.0;
		}
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

	private Map<String, Object> exportVariables(Story story) {
		Set<String> statsVariables = Set.copyOf(json.readStringList(story.getStatsVariablesJson()));
		Map<String, Object> variables = new java.util.LinkedHashMap<>();
		for (Map.Entry<String, Object> entry : json.readMap(story.getVariablesJson()).entrySet()) {
			if (statsVariables.contains(entry.getKey())) {
				Map<String, Object> definition = new java.util.LinkedHashMap<>();
				definition.put("value", entry.getValue());
				definition.put("showInStats", true);
				variables.put(entry.getKey(), definition);
			} else {
				variables.put(entry.getKey(), entry.getValue());
			}
		}
		return variables;
	}

	private Object emptyMapIfNull(Object value) {
		return value == null ? Map.of() : value;
	}

	@Transactional(readOnly = true)
	Map<String, Object> authorHome(String playerId) {
		Player player = player(playerId);
		List<AuthorStorySummary> stories = authoredStories(playerId);
		long published = stories.stream().filter(story -> "published".equals(story.status())).count();
		return Map.of(
				"playerId", player.getId(),
				"username", player.getUsername(),
				"stories", stories,
				"stats", Map.of(
						"totalStories", stories.size(),
						"publishedStories", published,
						"draftStories", stories.size() - published));
	}

	private Player player(String playerId) {
		if (playerId == null || playerId.isBlank()) {
			throw new PlayerNotFoundException();
		}
		return players.findById(playerId).orElseThrow(PlayerNotFoundException::new);
	}

	private Story ownedStory(String playerId, String storyId) {
		player(playerId);
		Story story = admin.story(storyId);
		if (story.getOwnerPlayerId() == null || !story.getOwnerPlayerId().equals(playerId)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Story belongs to another author");
		}
		return story;
	}

	private String playerName(String playerId) {
		if (playerId == null || playerId.isBlank()) {
			return "System";
		}
		return players.findById(playerId).map(Player::getUsername).orElse("Unknown");
	}

	record AuthorStorySummary(
			String storyId,
			String key,
			String title,
			String description,
			String status,
			String publishedSlug,
			Instant publishedAt,
			long totalRuns,
			long finishedRuns) {
	}

	record AuthorStoryDetails(
			String storyId,
			String key,
			String title,
			String description,
			String status,
			String publishedSlug,
			Instant publishedAt,
			long totalRuns,
			long finishedRuns) {
	}

	record StoryAnalytics(
			String storyId,
			String title,
			long totalRuns,
			long finishedRuns,
			double completionRate,
			List<RecentSession> recentSessions) {
	}

	record RecentSession(
			String sessionId,
			String playerId,
			String playerName,
			String status,
			String currentSceneKey,
			String endingSceneKey,
			Instant updatedAt) {
	}

	record PublishedStorySummary(
			String slug,
			String key,
			String title,
			String description,
			String authorName,
			long totalRuns,
			long finishedRuns,
			double completionRate,
			Instant publishedAt,
			Instant updatedAt,
			Instant lastPlayedAt) {
	}

	record PublishedStoryDetails(
			String slug,
			String key,
			String title,
			String description,
			String authorName,
			long totalRuns,
			long finishedRuns,
			Instant publishedAt,
			Instant updatedAt) {
	}
}
