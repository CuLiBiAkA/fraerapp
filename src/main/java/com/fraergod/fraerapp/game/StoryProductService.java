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
	private final GameSessionRepository sessions;
	private final StoryAdminService admin;

	StoryProductService(PlayerRepository players, StoryRepository stories, GameSessionRepository sessions, StoryAdminService admin) {
		this.players = players;
		this.stories = stories;
		this.sessions = sessions;
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
	List<PublishedStorySummary> publishedCatalog() {
		return stories.findByStatusAndPublishedSlugIsNotNullOrderByPublishedAtDesc(StoryStatus.PUBLISHED).stream()
				.map(story -> new PublishedStorySummary(
						story.getPublishedSlug(),
						story.getKey(),
						story.getTitle(),
						story.getDescription(),
						playerName(story.getOwnerPlayerId()),
						sessions.countByStoryId(story.getId()),
						sessions.countByStoryIdAndStatus(story.getId(), SessionStatus.FINISHED),
						story.getPublishedAt()))
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
				story.getPublishedAt());
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
			Instant publishedAt) {
	}

	record PublishedStoryDetails(
			String slug,
			String key,
			String title,
			String description,
			String authorName,
			long totalRuns,
			long finishedRuns,
			Instant publishedAt) {
	}
}
