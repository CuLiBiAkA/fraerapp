package com.fraergod.fraerapp.game;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.assets")
public class AssetStorageProperties {

	private String storagePath = "/data/uploads";

	private String publicPath = "/uploads";

	private long maxBytes = 10 * 1024 * 1024;

	public String getStoragePath() {
		return storagePath;
	}

	public void setStoragePath(String storagePath) {
		this.storagePath = storagePath;
	}

	public String getPublicPath() {
		return publicPath;
	}

	public void setPublicPath(String publicPath) {
		this.publicPath = publicPath;
	}

	public long getMaxBytes() {
		return maxBytes;
	}

	public void setMaxBytes(long maxBytes) {
		this.maxBytes = maxBytes;
	}
}
