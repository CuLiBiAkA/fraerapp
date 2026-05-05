package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface StoryVersionRepository extends JpaRepository<StoryVersion, String> {

	List<StoryVersion> findByStoryIdOrderByVersionNumberDesc(String storyId);

	Optional<StoryVersion> findByStoryIdAndVersionNumber(String storyId, int versionNumber);

	int countByStoryId(String storyId);
}
