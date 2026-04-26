package com.fraergod.fraerapp.game;

import java.util.List;

record StoryValidationResult(boolean valid, List<String> errors) {

	static StoryValidationResult of(List<String> errors) {
		return new StoryValidationResult(errors.isEmpty(), errors);
	}
}
