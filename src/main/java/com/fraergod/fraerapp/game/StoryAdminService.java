package com.fraergod.fraerapp.game;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
class StoryAdminService {

	private final StoryRepository stories;
	private final SceneRepository scenes;
	private final ChoiceRepository choices;
	private final StoryAssetRepository assets;
	private final JdbcTemplate jdbc;
	private final JsonSupport json;

	StoryAdminService(StoryRepository stories, SceneRepository scenes, ChoiceRepository choices,
			StoryAssetRepository assets, JdbcTemplate jdbc, JsonSupport json) {
		this.stories = stories;
		this.scenes = scenes;
		this.choices = choices;
		this.assets = assets;
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
		if (story.getId() != null) {
			deleteChildren(story.getId());
		}
		story.setTitle(document.title());
		story.setDescription(document.description());
		story.setVersion(document.version() <= 0 ? 1 : document.version());
		story.setStartSceneId(document.startSceneId());
		story.setVariablesJson(json.writeVariables(document.variables()));
		story.setStatus(story.getStatus() == null ? StoryStatus.DRAFT : story.getStatus());
		if (story.getOwnerPlayerId() == null && ownerPlayerId != null && !ownerPlayerId.isBlank()) {
			story.setOwnerPlayerId(ownerPlayerId);
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

		return new ImportResponse(story.getId(), story.getKey(), story.getTitle(), story.getStatus().name().toLowerCase());
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
			if (scene.getBackgroundAssetId() != null && !scene.getBackgroundAssetId().isBlank() && !assetKeys.contains(scene.getBackgroundAssetId())) {
				errors.add("Scene " + scene.getSceneKey() + " references missing background asset " + scene.getBackgroundAssetId());
			}
			if (scene.getMusicAssetId() != null && !scene.getMusicAssetId().isBlank() && !assetKeys.contains(scene.getMusicAssetId())) {
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
		stories.save(story);
		return new ImportResponse(story.getId(), story.getKey(), story.getTitle(), story.getStatus().name().toLowerCase());
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
			if (!blank(scene.background()) && !assetKeys.contains(scene.background())) {
				errors.add("Scene " + scene.id() + " references missing background asset " + scene.background());
			}
			if (!blank(scene.music()) && !assetKeys.contains(scene.music())) {
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

	record ImportResponse(String storyId, String key, String title, String status) {
	}
}
