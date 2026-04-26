package com.fraergod.fraerapp.game;

import java.util.List;

record StoryTree(
		String startNodeId,
		List<StoryNode> nodes) {
}
