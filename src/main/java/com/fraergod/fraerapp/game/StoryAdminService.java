package com.fraergod.fraerapp.game;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class StoryAdminService {

	private final StoryRepository stories;
	private final StoryVersionRepository versions;
	private final SceneRepository scenes;
	private final ChoiceRepository choices;
	private final StoryAssetRepository assets;
	private final StoryAssetStorageService assetStorage;
	private final PlayerRepository players;
	private final JdbcTemplate jdbc;
	private final JsonSupport json;

	StoryAdminService(StoryRepository stories, StoryVersionRepository versions, SceneRepository scenes, ChoiceRepository choices,
			StoryAssetRepository assets, StoryAssetStorageService assetStorage, PlayerRepository players, JdbcTemplate jdbc, JsonSupport json) {
		this.stories = stories;
		this.versions = versions;
		this.scenes = scenes;
		this.choices = choices;
		this.assets = assets;
		this.assetStorage = assetStorage;
		this.players = players;
		this.jdbc = jdbc;
		this.json = json;
	}

	@Transactional
	ImportResponse importStory(String body) {
		return importStory(body, null);
	}

	@Transactional
	ImportResponse importStory(String body, String ownerPlayerId) {
		StoryDocument document = json.readStory(body);
		StoryValidationResult validation = validate(document);
		if (!validation.valid()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.join("; ", validation.errors()));
		}

		Story story = stories.findByKey(document.key()).orElseGet(() -> new Story(document.key()));
		requireOwnerAccess(story, ownerPlayerId);
		if (story.getOwnerPlayerId() == null && ownerPlayerId != null && !ownerPlayerId.isBlank()) {
			story.setOwnerPlayerId(ownerPlayerId);
		}
		story = applyDocument(story, document, StoryStatus.DRAFT);
		assetStorage.deleteUnreferencedStoryFiles(story.getId(), referencedAssetUrls(document));
		StoryVersion version = saveVersion(story, "import");
		return response(story, version);
	}

	@Transactional(readOnly = true)
	List<AdminUserRuntimeStats> userRuntimeStats(List<String> userIds) {
		if (userIds == null || userIds.isEmpty()) {
			return List.of();
		}
		return userIds.stream()
				.distinct()
				.limit(100)
				.map(this::userRuntimeStats)
				.toList();
	}

	private AdminUserRuntimeStats userRuntimeStats(String userId) {
		return players.findByUserId(userId)
				.map(player -> {
					long sessionsCount = jdbc.queryForObject("select count(*) from game_sessions where player_id = ?", Long.class, player.getId());
					long finishedSessions = jdbc.queryForObject("select count(*) from game_sessions where player_id = ? and status = ?", Long.class,
							player.getId(), SessionStatus.FINISHED.name());
					long activeSessions = jdbc.queryForObject("select count(*) from game_sessions where player_id = ? and status = ?", Long.class,
							player.getId(), SessionStatus.ACTIVE.name());
					long authoredStories = jdbc.queryForObject("select count(*) from stories where owner_player_id = ?", Long.class, player.getId());
					long draftStories = jdbc.queryForObject("select count(*) from stories where owner_player_id = ? and status = ?", Long.class,
							player.getId(), StoryStatus.DRAFT.name());
					long reviewStories = jdbc.queryForObject("select count(*) from stories where owner_player_id = ? and status = ?", Long.class,
							player.getId(), StoryStatus.REVIEW.name());
					long publishedStories = jdbc.queryForObject("select count(*) from stories where owner_player_id = ? and status = ?", Long.class,
							player.getId(), StoryStatus.PUBLISHED.name());
					long archivedStories = jdbc.queryForObject("select count(*) from stories where owner_player_id = ? and status = ?", Long.class,
							player.getId(), StoryStatus.ARCHIVED.name());
					Long authoredRuns = jdbc.queryForObject("""
							select count(gs.id) from game_sessions gs
							join stories st on st.id = gs.story_id
							where st.owner_player_id = ?
							""", Long.class, player.getId());
					return new AdminUserRuntimeStats(
							userId,
							player.getId(),
							player.getUsername(),
							sessionsCount,
							activeSessions,
							finishedSessions,
							authoredStories,
							draftStories,
							reviewStories,
							publishedStories,
							archivedStories,
							authoredRuns == null ? 0 : authoredRuns);
				})
				.orElse(new AdminUserRuntimeStats(userId, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0));
	}

	@Transactional(readOnly = true)
	AdminStoryPage adminStories(int page, int size, String status) {
		int safePage = Math.max(0, page);
		int safeSize = Math.min(100, Math.max(1, size));
		PageRequest request = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "updatedAt"));
		Page<Story> result = parseStatus(status)
				.map(storyStatus -> stories.findByStatus(storyStatus, request))
				.orElseGet(() -> stories.findAll(request));
		return new AdminStoryPage(
				result.getNumber(),
				result.getSize(),
				result.getTotalElements(),
				result.getTotalPages(),
				result.getContent().stream().map(this::adminSummary).toList());
	}

	@Transactional(readOnly = true)
	StoryValidationResult validateStory(String storyId) {
		Story story = story(storyId);
		List<Scene> storyScenes = scenes.findByStoryIdOrderByOrderIndexAsc(story.getId());
		List<StoryAsset> storyAssets = assets.findByStoryId(story.getId());
		List<String> errors = new ArrayList<>();
		Set<String> sceneKeys = storyScenes.stream().map(Scene::getSceneKey).collect(Collectors.toSet());
		Set<String> assetKeys = storyAssets.stream().map(StoryAsset::getAssetKey).collect(Collectors.toSet());

		if (story.getStartSceneId() == null || story.getStartSceneId().isBlank()) {
			errors.add("Story " + story.getKey() + " has no startSceneId");
		} else if (!sceneKeys.contains(story.getStartSceneId())) {
			errors.add("Story " + story.getKey() + " startSceneId points to missing scene " + story.getStartSceneId());
		}

		for (Scene scene : storyScenes) {
			Set<String> sceneAssetKeys = new HashSet<>(assetKeys);
			for (com.fasterxml.jackson.databind.JsonNode asset : json.readNodeList(scene.getLocalAssetsJson())) {
				if (asset.hasNonNull("id")) {
					sceneAssetKeys.add(asset.get("id").asText());
				}
			}
			if (scene.getBackgroundAssetId() != null && !scene.getBackgroundAssetId().isBlank() && !sceneAssetKeys.contains(scene.getBackgroundAssetId())) {
				errors.add("Scene " + scene.getSceneKey() + " references missing background asset " + scene.getBackgroundAssetId());
			}
			if (scene.getMusicAssetId() != null && !scene.getMusicAssetId().isBlank() && !sceneAssetKeys.contains(scene.getMusicAssetId())) {
				errors.add("Scene " + scene.getSceneKey() + " references missing music asset " + scene.getMusicAssetId());
			}
			Set<String> choiceKeys = new HashSet<>();
			for (Choice choice : choices.findBySceneIdOrderByOrderIndexAsc(scene.getId())) {
				if (!choiceKeys.add(choice.getChoiceKey())) {
					errors.add("Scene " + scene.getSceneKey() + " has duplicate choice " + choice.getChoiceKey());
				}
				if (!sceneKeys.contains(choice.getTargetSceneKey())) {
					errors.add("Scene " + scene.getSceneKey() + " has choice " + choice.getChoiceKey()
							+ " pointing to missing target " + choice.getTargetSceneKey());
				}
				if (!blank(choice.getFallbackTargetSceneKey()) && !sceneKeys.contains(choice.getFallbackTargetSceneKey())) {
					errors.add("Scene " + scene.getSceneKey() + " has choice " + choice.getChoiceKey()
							+ " pointing to missing fallback target " + choice.getFallbackTargetSceneKey());
				}
			}
		}
		return StoryValidationResult.of(errors);
	}

	@Transactional
	Object publish(String storyId) {
		return publish(storyId, null);
	}

	@Transactional
	ImportResponse publish(String storyId, String ownerPlayerId) {
		Story story = story(storyId);
		requireOwnerAccess(story, ownerPlayerId);
		StoryValidationResult validation = validateStory(storyId);
		if (!validation.valid()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.join("; ", validation.errors()));
		}
		story.setStatus(StoryStatus.PUBLISHED);
		if (story.getPublishedSlug() == null || story.getPublishedSlug().isBlank()) {
			story.setPublishedSlug(uniqueSlug(story.getKey(), story.getTitle()));
		}
		story.setPublishedAt(java.time.Instant.now());
		story.setArchivedAt(null);
		stories.save(story);
		return response(story, saveVersion(story, "publish"));
	}

	@Transactional
	ImportResponse submitForReview(String storyId, String ownerPlayerId) {
		Story story = story(storyId);
		requireOwnerAccess(story, ownerPlayerId);
		StoryValidationResult validation = validateStory(storyId);
		if (!validation.valid()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, String.join("; ", validation.errors()));
		}
		story.setStatus(StoryStatus.REVIEW);
		stories.save(story);
		return response(story, saveVersion(story, "submit_review"));
	}

	@Transactional
	ImportResponse archive(String storyId, String ownerPlayerId) {
		Story story = story(storyId);
		requireOwnerAccess(story, ownerPlayerId);
		story.setStatus(StoryStatus.ARCHIVED);
		story.setArchivedAt(java.time.Instant.now());
		stories.save(story);
		return response(story, saveVersion(story, "archive"));
	}

	@Transactional(readOnly = true)
	Map<String, Object> preview(String storyId, String ownerPlayerId) {
		Story story = story(storyId);
		requireOwnerAccess(story, ownerPlayerId);
		Map<String, Object> result = new java.util.LinkedHashMap<>();
		result.put("storyId", story.getId());
		result.put("status", story.getStatus().name().toLowerCase());
		result.put("publishedSlug", story.getPublishedSlug());
		result.put("document", exportStoryDocument(story));
		return result;
	}

	@Transactional(readOnly = true)
	List<StoryVersionSummary> versions(String storyId, String ownerPlayerId) {
		Story story = story(storyId);
		requireOwnerAccess(story, ownerPlayerId);
		return versions.findByStoryIdOrderByVersionNumberDesc(story.getId()).stream()
				.map(version -> new StoryVersionSummary(
						version.getVersionNumber(),
						version.getStatus().name().toLowerCase(),
						version.getNote(),
						version.getCreatedAt()))
				.toList();
	}

	@Transactional
	ImportResponse rollback(String storyId, int versionNumber, String ownerPlayerId) {
		Story story = story(storyId);
		requireOwnerAccess(story, ownerPlayerId);
		StoryVersion version = versions.findByStoryIdAndVersionNumber(story.getId(), versionNumber)
				.orElseThrow(StoryNotFoundException::new);
		StoryDocument document = json.readStory(version.getSnapshotJson());
		story = applyDocument(story, document, version.getStatus());
		StoryVersion rollbackVersion = saveVersion(story, "rollback_to_" + versionNumber);
		return response(story, rollbackVersion);
	}

	@Transactional
	void deleteStory(String storyId, String ownerPlayerId) {
		Story story = story(storyId);
		requireOwnerAccess(story, ownerPlayerId);
		jdbc.update("delete from game_sessions where story_id = ?", story.getId());
		jdbc.update("delete from story_versions where story_id = ?", story.getId());
		deleteChildren(story.getId());
		stories.delete(story);
		assetStorage.deleteStoryFiles(story.getId());
	}

	private Optional<StoryStatus> parseStatus(String status) {
		if (status == null || status.isBlank() || "all".equalsIgnoreCase(status)) {
			return Optional.empty();
		}
		try {
			return Optional.of(StoryStatus.valueOf(status.trim().toUpperCase()));
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown story status: " + status);
		}
	}

	private AdminStorySummary adminSummary(Story story) {
		long runs = jdbc.queryForObject("select count(*) from game_sessions where story_id = ?", Long.class, story.getId());
		long versionsCount = jdbc.queryForObject("select count(*) from story_versions where story_id = ?", Long.class, story.getId());
		String ownerName = story.getOwnerPlayerId() == null
				? null
				: players.findById(story.getOwnerPlayerId()).map(Player::getUsername).orElse(null);
		return new AdminStorySummary(
				story.getId(),
				story.getKey(),
				story.getTitle(),
				story.getStatus().name().toLowerCase(),
				story.getPublishedSlug(),
				ownerName,
				runs,
				versionsCount,
				story.getPublishedAt(),
				story.getArchivedAt(),
				story.getUpdatedAt());
	}

	Map<String, Object> exportStoryDocument(Story story) {
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
					item.put("variables", exportSceneVariables(scene));
					item.put("assets", json.readObjectList(scene.getLocalAssetsJson()));
					item.put("animation", emptyMapIfNull(json.readObject(scene.getAnimationJson())));
					item.put("effects", json.readObjectList(scene.getEffectsJson()));
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
								choiceItem.put("fallbackTarget", choice.getFallbackTargetSceneKey());
								choiceItem.put("conditions", json.readObjectList(choice.getConditionsJson()));
								choiceItem.put("effects", json.readObjectList(choice.getEffectsJson()));
								return choiceItem;
							})
							.toList());
					return item;
				})
				.toList());
		return document;
	}

	private Story applyDocument(Story story, StoryDocument document, StoryStatus status) {
		if (story.getId() != null) {
			deleteChildren(story.getId());
		}
		story.setTitle(document.title());
		story.setDescription(document.description());
		story.setVersion(document.version() <= 0 ? 1 : document.version());
		story.setStartSceneId(document.startSceneId());
		story.setVariablesJson(json.writeVariables(document.variables()));
		story.setStatsVariablesJson(json.writeStatsVariables(document.variables()));
		story.setStatus(status);
		if (status != StoryStatus.ARCHIVED) {
			story.setArchivedAt(null);
		}
		story = stories.save(story);

		if (document.assets() != null) {
			for (StoryDocument.AssetDocument asset : document.assets()) {
				assets.save(new StoryAsset(story.getId(), asset.id(), asset.type(), asset.url(), json.writeObject(asset.metadata())));
			}
		}
		if (document.scenes() != null) {
			int sceneIndex = 0;
			for (StoryDocument.SceneDocument sceneDocument : document.scenes()) {
				Scene scene = scenes.save(new Scene(story.getId(), sceneDocument, json, sceneIndex++));
				int choiceIndex = 0;
				if (sceneDocument.choices() != null) {
					for (StoryDocument.ChoiceDocument choice : sceneDocument.choices()) {
						choices.save(new Choice(scene.getId(), choice, json, choiceIndex++));
					}
				}
			}
		}
		return story;
	}

	private StoryVersion saveVersion(Story story, String note) {
		StoryVersion version = new StoryVersion(
				story.getId(),
				versions.countByStoryId(story.getId()) + 1,
				story.getStatus(),
				json.write(exportStoryDocument(story)),
				note);
		return versions.save(version);
	}

	private ImportResponse response(Story story, StoryVersion version) {
		return new ImportResponse(
				story.getId(),
				story.getKey(),
				story.getTitle(),
				story.getStatus().name().toLowerCase(),
				version == null ? null : version.getVersionNumber());
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

	private Map<String, Object> exportSceneVariables(Scene scene) {
		Map<String, Object> variables = new java.util.LinkedHashMap<>();
		for (Map.Entry<String, Object> entry : json.readMap(scene.getLocalVariablesJson()).entrySet()) {
			variables.put(entry.getKey(), entry.getValue());
		}
		return variables;
	}

	private Object emptyMapIfNull(Object value) {
		return value == null ? Map.of() : value;
	}

	private StoryValidationResult validate(StoryDocument document) {
		List<String> errors = new ArrayList<>();
		if (blank(document.key())) {
			errors.add("Story key is required");
		}
		if (blank(document.title())) {
			errors.add("Story title is required");
		}
		if (blank(document.startSceneId())) {
			errors.add("startSceneId is required");
		}
		if (document.scenes() == null || document.scenes().isEmpty()) {
			errors.add("At least one scene is required");
			return StoryValidationResult.of(errors);
		}

		Set<String> sceneKeys = new HashSet<>();
		Set<String> assetKeys = document.assets() == null ? Set.of() : document.assets().stream()
				.map(StoryDocument.AssetDocument::id)
				.collect(Collectors.toSet());

		for (StoryDocument.SceneDocument scene : document.scenes()) {
			if (blank(scene.id())) {
				errors.add("Scene id is required");
			} else if (!sceneKeys.add(scene.id())) {
				errors.add("Duplicate scene id " + scene.id());
			}
		}
		if (!blank(document.startSceneId()) && !sceneKeys.contains(document.startSceneId())) {
			errors.add("startSceneId points to missing scene " + document.startSceneId());
		}
		for (StoryDocument.SceneDocument scene : document.scenes()) {
			Set<String> sceneAssetKeys = new HashSet<>(assetKeys);
			if (scene.assets() != null) {
				scene.assets().stream()
						.map(StoryDocument.AssetDocument::id)
						.filter(id -> id != null && !id.isBlank())
						.forEach(sceneAssetKeys::add);
			}
			if (!blank(scene.background()) && !sceneAssetKeys.contains(scene.background())) {
				errors.add("Scene " + scene.id() + " references missing background asset " + scene.background());
			}
			if (!blank(scene.music()) && !sceneAssetKeys.contains(scene.music())) {
				errors.add("Scene " + scene.id() + " references missing music asset " + scene.music());
			}
			Set<String> choiceKeys = new HashSet<>();
			if (scene.choices() != null) {
				for (StoryDocument.ChoiceDocument choice : scene.choices()) {
					if (blank(choice.id())) {
						errors.add("Scene " + scene.id() + " has choice without id");
					} else if (!choiceKeys.add(choice.id())) {
						errors.add("Scene " + scene.id() + " has duplicate choice " + choice.id());
					}
					if (blank(choice.target()) || !sceneKeys.contains(choice.target())) {
						errors.add("Scene " + scene.id() + " has choice " + choice.id()
								+ " pointing to missing target " + choice.target());
					}
					if (!blank(choice.fallbackTarget()) && !sceneKeys.contains(choice.fallbackTarget())) {
						errors.add("Scene " + scene.id() + " has choice " + choice.id()
								+ " pointing to missing fallback target " + choice.fallbackTarget());
					}
				}
			}
		}
		return StoryValidationResult.of(errors);
	}

	private void deleteChildren(String storyId) {
		jdbc.update("delete from choices where scene_id in (select id from scenes where story_id = ?)", storyId);
		jdbc.update("delete from scenes where story_id = ?", storyId);
		jdbc.update("delete from assets where story_id = ?", storyId);
	}

	private Set<String> referencedAssetUrls(StoryDocument document) {
		Set<String> urls = new HashSet<>();
		if (document.assets() != null) {
			urls.addAll(document.assets().stream()
				.map(StoryDocument.AssetDocument::url)
				.filter(url -> url != null && !url.isBlank())
				.collect(Collectors.toSet()));
		}
		if (document.scenes() != null) {
			for (StoryDocument.SceneDocument scene : document.scenes()) {
				if (scene.assets() != null) {
					scene.assets().stream()
							.map(StoryDocument.AssetDocument::url)
							.filter(url -> url != null && !url.isBlank())
							.forEach(urls::add);
				}
			}
		}
		return urls;
	}

	Story story(String storyId) {
		return stories.findById(storyId).orElseThrow(StoryNotFoundException::new);
	}

	private void requireOwnerAccess(Story story, String ownerPlayerId) {
		if (ownerPlayerId == null || ownerPlayerId.isBlank() || story.getId() == null || story.getOwnerPlayerId() == null) {
			return;
		}
		if (!ownerPlayerId.equals(story.getOwnerPlayerId())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Story belongs to another author");
		}
	}

	private String uniqueSlug(String key, String title) {
		String base = slugify(title == null || title.isBlank() ? key : title);
		if (base.isBlank()) {
			base = slugify(key);
		}
		base = base.isBlank() ? "story" : base;
		String candidate = base;
		int suffix = 2;
		while (stories.existsByPublishedSlug(candidate)) {
			candidate = base + "-" + suffix++;
		}
		return candidate;
	}

	private String slugify(String value) {
		String ascii = java.text.Normalizer.normalize(value == null ? "" : value, java.text.Normalizer.Form.NFD)
				.replaceAll("\\p{M}+", "")
				.toLowerCase(java.util.Locale.ROOT)
				.replaceAll("[^a-z0-9]+", "-")
				.replaceAll("(^-|-$)", "");
		return ascii.length() > 160 ? ascii.substring(0, 160) : ascii;
	}

	private boolean blank(String value) {
		return value == null || value.isBlank();
	}

	record ImportResponse(String storyId, String key, String title, String status, Integer versionNumber) {
	}

	record StoryVersionSummary(int versionNumber, String status, String note, java.time.Instant createdAt) {
	}

	record AdminStoryPage(int page, int size, long totalElements, int totalPages, List<AdminStorySummary> items) {
	}

	record AdminStorySummary(
			String storyId,
			String key,
			String title,
			String status,
			String publishedSlug,
			String ownerName,
			long totalRuns,
			long versions,
			java.time.Instant publishedAt,
			java.time.Instant archivedAt,
			java.time.Instant updatedAt) {
	}

	record AdminUserRuntimeStats(
			String userId,
			String playerId,
			String username,
			long sessions,
			long activeSessions,
			long finishedSessions,
			long authoredStories,
			long draftStories,
			long reviewStories,
			long publishedStories,
			long archivedStories,
			long authoredRuns) {
	}
}
