package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

interface StoryRepository extends JpaRepository<Story, String> {

	Optional<Story> findByKey(String key);

	List<Story> findByStatusOrderByTitleAsc(StoryStatus status);

	Page<Story> findByStatus(StoryStatus status, Pageable pageable);

	List<Story> findByOwnerPlayerIdOrderByUpdatedAtDesc(String ownerPlayerId);

	List<Story> findByStatusAndPublishedSlugIsNotNullOrderByPublishedAtDesc(StoryStatus status);

	Optional<Story> findByPublishedSlug(String publishedSlug);

	boolean existsByPublishedSlug(String publishedSlug);
}
