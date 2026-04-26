package com.fraergod.fraerapp.game;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

interface SceneRepository extends JpaRepository<Scene, String> {

	List<Scene> findByStoryIdOrderByOrderIndexAsc(String storyId);

	Optional<Scene> findByStoryIdAndSceneKey(String storyId, String sceneKey);
}
