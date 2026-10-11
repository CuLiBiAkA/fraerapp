package com.fraergod.fraerapp.game;

import static org.assertj.core.api.Assertions.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.*;
import java.util.Random;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

class StoryImageUploadTests {
 @TempDir Path directory;
 StoryAssetStorageService storage(){var config=new AssetStorageProperties();config.setStoragePath(directory.toString());return new StoryAssetStorageService(config);}
 MockMultipartFile image(BufferedImage image,String format) throws Exception {
  var bytes=new ByteArrayOutputStream();ImageIO.write(image,format,bytes);
  return new MockMultipartFile("file","source."+format,"image/"+(format.equals("jpg")?"jpeg":format),bytes.toByteArray());
 }
 @Test void uploadedPhotoIsBoundedAndActuallyDecodable() throws Exception {
  var source=new BufferedImage(2600,1500,BufferedImage.TYPE_INT_RGB);var random=new Random(1);
  for(int y=0;y<source.getHeight();y++)for(int x=0;x<source.getWidth();x++)source.setRGB(x,y,random.nextInt());
  var result=storage().store("owned",image(source,"jpg"));
  assertThat(result.size()).isLessThanOrEqualTo(500*1024);
  var stored=ImageIO.read(directory.resolve("owned").resolve(result.filename()).toFile());
  assertThat(stored.getWidth()).isLessThanOrEqualTo(1920);
  assertThat(stored.getHeight()).isLessThanOrEqualTo(1080);
  assertThat((double)stored.getWidth()/stored.getHeight()).isCloseTo(2600.0/1500,within(.01));
 }
 @Test void transparentImageKeepsItsAlphaAndSmallImageIsNotUpscaled() throws Exception {
  var source=new BufferedImage(80,60,BufferedImage.TYPE_INT_ARGB);source.setRGB(20,20,0x80ff0000);
  var result=storage().store("owned",image(source,"png"));
  var stored=ImageIO.read(directory.resolve("owned").resolve(result.filename()).toFile());
  assertThat(stored.getWidth()).isEqualTo(80);assertThat(stored.getHeight()).isEqualTo(60);
  assertThat(stored.getRGB(0,0)>>>24).isZero();assertThat(stored.getRGB(20,20)>>>24).isEqualTo(128);
 }
 @Test void fakeRasterIsRejectedBeforeWriting() throws Exception {
  assertThatThrownBy(()->storage().store("owned",new MockMultipartFile("file","fake.png","image/png","not an image".getBytes())))
    .isInstanceOf(ResponseStatusException.class);
  assertThat(Files.exists(directory.resolve("owned"))).isFalse();
 }
}
