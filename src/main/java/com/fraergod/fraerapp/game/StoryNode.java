package com.fraergod.fraerapp.game;

import java.util.List;

public record StoryNode(
		String id,
		String title,
		String text,
		String imageUrl,
		String musicUrl,
		List<StoryChoice> choices) {
}
