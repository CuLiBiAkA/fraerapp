package com.fraergod.fraerapp.game;

import org.springframework.data.jpa.repository.JpaRepository;

interface GameSessionRepository extends JpaRepository<GameSession, String> {

	long countByStoryId(String storyId);

	long countByStoryIdAndStatus(String storyId, SessionStatus status);

	java.util.List<GameSession> findTop20ByStoryIdOrderByUpdatedAtDesc(String storyId);

	java.util.List<GameSession> findByPlayerIdOrderByUpdatedAtDesc(String playerId);
}
