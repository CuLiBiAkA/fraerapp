package com.fraergod.fraerapp.game;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
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
	private final StoryAssetStorageService assetStorage;
	private final StoryWorkflowService workflow;
	private final StoryAccessService access;
	private final CollectionService collections;

	StoryProductService(PlayerRepository players, StoryRepository stories, SceneRepository scenes, ChoiceRepository choices,
			StoryAssetRepository assets, GameSessionRepository sessions, JsonSupport json, StoryAdminService admin,
			StoryAssetStorageService assetStorage,StoryWorkflowService workflow,StoryAccessService access,CollectionService collections) {
		this.players = players;
		this.stories = stories;
		this.scenes = scenes;
		this.choices = choices;
		this.assets = assets;
		this.sessions = sessions;
		this.json = json;
		this.admin = admin;
		this.assetStorage = assetStorage;
		this.workflow = workflow;
		this.access = access;
		this.collections = collections;
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
		return admin.exportStoryDocument(story);
	}

	@Transactional(readOnly = true)
	Map<String, Object> previewForAuthor(String playerId, String storyId) {
		ownedStory(playerId, storyId);
		return admin.preview(storyId, playerId);
	}

	@Transactional(readOnly = true)
	List<StoryAdminService.StoryVersionSummary> versionsForAuthor(String playerId, String storyId) {
		ownedStory(playerId, storyId);
		return admin.versions(storyId, playerId);
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

	@Transactional
	UploadedAsset uploadAssetForAuthor(String playerId, String storyId, MultipartFile file, String assetKey, String type, String scope) {
		Story story = ownedStory(playerId, storyId);
		if ("deleted".equals(story.getVisibility())) throw new ResponseStatusException(HttpStatus.CONFLICT, "Restore the story before uploading");
		StoryAssetStorageService.StoredAsset stored = assetStorage.store(story.getId(), file);
		String resolvedType = normalizeAssetType(type, stored.contentType());
		String resolvedKey = uniqueAssetKey(story.getId(), assetKey, file.getOriginalFilename(), resolvedType);
		Map<String, Object> metadata = new java.util.LinkedHashMap<>();
		metadata.put("filename", file.getOriginalFilename() == null ? stored.filename() : file.getOriginalFilename());
		metadata.put("contentType", stored.contentType());
		metadata.put("size", stored.size());
		metadata.put("uploadedAt", Instant.now().toString());
		if ("local".equalsIgnoreCase(scope)) {
			metadata.put("scope", "local");
			return new UploadedAsset(resolvedKey, resolvedType, stored.url(), metadata);
		}

		workflow.putDraftAsset(storyId,playerId,resolvedKey,resolvedType,stored.url(),metadata);
		return new UploadedAsset(resolvedKey, resolvedType, stored.url(), metadata);
	}

	@Transactional
	DeletedAsset deleteAssetForAuthor(String playerId, String storyId, String assetKey, String url) {
		Story story = ownedStory(playerId, storyId);
		workflow.removeDraftAsset(storyId,playerId,assetKey,url);
		return new DeletedAsset(true,assetKey,url,false);
	}

	@Transactional(readOnly = true)
	List<PublishedStorySummary> publishedCatalog(String playerId) {
		var chapters=collections.listedChapterIds();
		Map<String, GameSession> lastSessionByStoryId = lastSessionByStoryId(playerId);
		return stories.findByStatusAndPublishedSlugIsNotNullOrderByPublishedAtDesc(StoryStatus.PUBLISHED).stream().filter(StoryAccessService::listed)
				.filter(story -> !chapters.contains(story.getId()))
				.map(story -> {
					long totalRuns = sessions.countByStoryId(story.getId());
					long finishedRuns = sessions.countByStoryIdAndStatus(story.getId(), SessionStatus.FINISHED);
					GameSession recent = lastSessionByStoryId.get(story.getId());
					GameSession lastSession = recent!=null&&access.supportsRevision(story,recent.getStoryRevision())?recent:null;
					Story snapshot=lastSession==null?null:access.atRevision(story,lastSession.getStoryRevision());
					StoryDocument.SceneDocument lastScene = snapshot==null?null:snapshot.getRuntimeDocument().scenes().stream().filter(sc->sc.id().equals(lastSession.getCurrentSceneKey())).findFirst().orElse(null);
					return new PublishedStorySummary(
						story.getPublishedSlug(),
						story.getKey(),
						story.getTitle(),
						story.getDescription(),
						playerName(story.getOwnerPlayerId()),
						totalRuns,
						finishedRuns,
						storyProgress(snapshot, lastSession),
						story.getPublishedAt(),
						story.getUpdatedAt(),
						lastSession == null ? null : lastSession.getUpdatedAt(),
						lastSession == null ? null : lastSession.getId(),
						lastSession == null ? null : lastSession.getSaveName(),
						lastSession == null ? null : lastSession.getStatus().name().toLowerCase(),
						lastScene == null ? null : lastScene.title());
				})
				.toList();
	}

	@Transactional(readOnly = true)
	PublishedStoryDetails publishedStory(String slug) {
		Story story = stories.findByPublishedSlug(slug)
				.filter(StoryAccessService::available)
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

	private double storyProgress(Story story, GameSession session) {
		if (session == null) {
			return 0.0;
		}
		if (session.getStatus() == SessionStatus.FINISHED) {
			return 100.0;
		}
		List<StoryDocument.SceneDocument> storyScenes = story.getRuntimeDocument().scenes();
		if (storyScenes.isEmpty()) {
			return 0.0;
		}
		for (int index = 0; index < storyScenes.size(); index++) {
			if (storyScenes.get(index).id().equals(session.getCurrentSceneKey())) {
				return ((index + 1) * 100.0) / storyScenes.size();
			}
		}
		return 0.0;
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

	private String normalizeAssetType(String requestedType, String contentType) {
		if (requestedType != null && List.of("image", "music", "sound", "sprite").contains(requestedType)) {
			return requestedType;
		}
		return contentType.startsWith("audio/") ? "music" : "image";
	}

	private String uniqueAssetKey(String storyId, String requestedKey, String filename, String type) {
		String base = slugifyAssetKey(requestedKey);
		if (base.isBlank()) {
			base = slugifyAssetKey(filename);
		} else {
			return base;
		}
		if (base.isBlank()) {
			base = type == null || type.isBlank() ? "asset" : type;
		}
		Set<String> existing = assets.findByStoryId(storyId).stream()
				.map(StoryAsset::getAssetKey)
				.collect(Collectors.toSet());
		if (!existing.contains(base)) {
			return base;
		}
		int suffix = 2;
		String candidate = base + "_" + suffix;
		while (existing.contains(candidate)) {
			candidate = base + "_" + ++suffix;
		}
		return candidate;
	}

	private String slugifyAssetKey(String value) {
		String clean = value == null ? "" : value.replaceFirst("\\.[^.]+$", "");
		return java.text.Normalizer.normalize(clean, java.text.Normalizer.Form.NFD)
				.replaceAll("\\p{M}+", "")
				.toLowerCase(java.util.Locale.ROOT)
				.replaceAll("[^a-z0-9_]+", "_")
				.replaceAll("(^_+|_+$)", "");
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
			Instant lastPlayedAt,
			String lastSessionId,
			String lastSaveName,
			String lastSessionStatus,
			String lastSceneTitle) {
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

	record UploadedAsset(String id, String type, String url, Map<String, Object> metadata) {
	}

	record DeletedAsset(boolean deleted, String id, String url, boolean fileDeleted) {
	}
}
