package com.fraergod.fraerapp.game;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StoryAssetStorageService {

	private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/svg+xml",
			"audio/mpeg",
			"audio/ogg",
			"audio/wav",
			"audio/webm");

	private final AssetStorageProperties properties;

	StoryAssetStorageService(AssetStorageProperties properties) {
		this.properties = properties;
	}

	StoredAsset store(String storyId, MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Asset file is required");
		}
		if (file.getSize() > properties.getMaxBytes()) {
			throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Asset file is too large");
		}
		String contentType = file.getContentType() == null ? "application/octet-stream" : file.getContentType().toLowerCase(Locale.ROOT);
		if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported asset type: " + contentType);
		}

		String extension = extension(file.getOriginalFilename(), contentType);
		String filename = UUID.randomUUID() + extension;
		Path directory = storyDirectory(storyId);
		Path target = directory.resolve(filename).normalize();
		if (!target.startsWith(directory)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid asset path");
		}
		try {
			Files.createDirectories(directory);
			try (InputStream input = file.getInputStream()) {
				Files.copy(input, target);
			}
		} catch (IOException ex) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store asset", ex);
		}
		return new StoredAsset(publicUrl(storyId, filename), contentType, file.getSize(), filename);
	}

	void deleteUnreferencedStoryFiles(String storyId, Set<String> referencedUrls) {
		Path directory = storyDirectory(storyId);
		if (!Files.isDirectory(directory)) {
			return;
		}
		try (Stream<Path> files = Files.list(directory)) {
			files.filter(Files::isRegularFile)
					.filter(file -> !referencedUrls.contains(publicUrl(storyId, file.getFileName().toString())))
					.forEach(this::deleteQuietly);
		} catch (IOException ignored) {
		}
	}

	boolean deleteStoryFileByPublicUrl(String storyId, String url) {
		Path file = filePathFromPublicUrl(storyId, url);
		if (file == null || !Files.isRegularFile(file)) {
			return false;
		}
		deleteQuietly(file);
		return true;
	}

	boolean isStoryUploadUrl(String storyId, String url) {
		return filePathFromPublicUrl(storyId, url) != null;
	}

	void deleteStoryFiles(String storyId) {
		Path directory = storyDirectory(storyId);
		if (!Files.isDirectory(directory)) {
			return;
		}
		try (Stream<Path> files = Files.walk(directory)) {
			files.sorted(Comparator.reverseOrder())
					.forEach(this::deleteQuietly);
		} catch (IOException ignored) {
		}
	}

	public Path rootPath() {
		return Path.of(properties.getStoragePath()).toAbsolutePath().normalize();
	}

	public String publicPathPattern() {
		return normalizePublicPath() + "/**";
	}

	private Path storyDirectory(String storyId) {
		String safeStoryId = safeSegment(storyId);
		return rootPath().resolve(safeStoryId).normalize();
	}

	private String publicUrl(String storyId, String filename) {
		return normalizePublicPath() + "/" + safeSegment(storyId) + "/" + filename;
	}

	private Path filePathFromPublicUrl(String storyId, String url) {
		if (url == null || url.isBlank()) {
			return null;
		}
		String normalizedUrl = url.trim().replace('\\', '/');
		String expectedPrefix = normalizePublicPath() + "/" + safeSegment(storyId) + "/";
		if (!normalizedUrl.startsWith(expectedPrefix)) {
			return null;
		}
		String filename = normalizedUrl.substring(expectedPrefix.length());
		if (filename.isBlank() || filename.contains("/")) {
			return null;
		}
		Path directory = storyDirectory(storyId);
		Path target = directory.resolve(filename).normalize();
		return target.startsWith(directory) ? target : null;
	}

	private String normalizePublicPath() {
		String value = properties.getPublicPath() == null || properties.getPublicPath().isBlank()
				? "/uploads"
				: properties.getPublicPath().trim();
		return value.startsWith("/") ? value.replaceAll("/+$", "") : "/" + value.replaceAll("/+$", "");
	}

	private String safeSegment(String value) {
		String ascii = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
				.replaceAll("\\p{M}+", "")
				.toLowerCase(Locale.ROOT)
				.replaceAll("[^a-z0-9_-]+", "-")
				.replaceAll("(^-|-$)", "");
		return ascii.isBlank() ? "story" : ascii;
	}

	private String extension(String filename, String contentType) {
		String clean = StringUtils.cleanPath(filename == null ? "" : filename);
		int dot = clean.lastIndexOf('.');
		if (dot >= 0 && dot < clean.length() - 1) {
			String candidate = clean.substring(dot).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9.]", "");
			if (!candidate.isBlank() && candidate.length() <= 12) {
				return candidate;
			}
		}
		return switch (contentType) {
			case "image/jpeg" -> ".jpg";
			case "image/png" -> ".png";
			case "image/gif" -> ".gif";
			case "image/webp" -> ".webp";
			case "image/svg+xml" -> ".svg";
			case "audio/mpeg" -> ".mp3";
			case "audio/ogg" -> ".ogg";
			case "audio/wav" -> ".wav";
			case "audio/webm" -> ".webm";
			default -> "";
		};
	}

	private void deleteQuietly(Path path) {
		try {
			Files.deleteIfExists(path);
		} catch (IOException ignored) {
		}
	}

	record StoredAsset(String url, String contentType, long size, String filename) {
	}
}
