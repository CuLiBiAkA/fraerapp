package com.fraergod.fraerapp.game;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

@Entity
@Table(name = "choices")
class Choice {

	@Id
	private String id;

	@Column(nullable = false, length = 36)
	private String sceneId;

	@Column(nullable = false, length = 120)
	private String choiceKey;

	@Column(nullable = false, length = 240)
	private String label;

	@Column(nullable = false, length = 120)
	private String targetSceneKey;

	@Lob
	@Column(nullable = false)
	private String conditionsJson = "[]";

	@Lob
	@Column(nullable = false)
	private String effectsJson = "[]";

	@Column(nullable = false)
	private int orderIndex;

	protected Choice() {
	}

	Choice(String sceneId, StoryDocument.ChoiceDocument choice, JsonSupport json, int orderIndex) {
		this.id = UUID.randomUUID().toString();
		this.sceneId = sceneId;
		this.choiceKey = choice.id();
		this.label = choice.label();
		this.targetSceneKey = choice.target();
		this.conditionsJson = json.writeArray(choice.conditions());
		this.effectsJson = json.writeArray(choice.effects());
		this.orderIndex = orderIndex;
	}

	String getChoiceKey() {
		return choiceKey;
	}

	String getLabel() {
		return label;
	}

	String getTargetSceneKey() {
		return targetSceneKey;
	}

	String getConditionsJson() {
		return conditionsJson;
	}

	String getEffectsJson() {
		return effectsJson;
	}
}
