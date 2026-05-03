package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface StoryAssetRepository extends JpaRepository<StoryAsset, String> {

	List<StoryAsset> findByStoryId(String storyId);

	Optional<StoryAsset> findByStoryIdAndAssetKey(String storyId, String assetKey);
}
