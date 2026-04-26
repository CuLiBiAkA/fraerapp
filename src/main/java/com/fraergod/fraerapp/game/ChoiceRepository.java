package com.fraergod.fraerapp.game;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

interface ChoiceRepository extends JpaRepository<Choice, String> {

	List<Choice> findBySceneIdOrderByOrderIndexAsc(String sceneId);
}
