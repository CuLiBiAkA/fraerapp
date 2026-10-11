package com.fraergod.fraerapp.game;

import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.*;
import javax.imageio.*;
import javax.imageio.stream.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Bound decoded pixels and stored image size; never trust the uploaded MIME alone. */
final class RasterImageNormalizer {
 static final int MAX_WIDTH=1920, MAX_HEIGHT=1080, MAX_BYTES=500*1024;
 record Image(byte[] bytes,String type,String extension) {}
 static Image normalize(InputStream source) throws IOException {
  BufferedImage original;
  try(var input=new MemoryCacheImageInputStream(source)) {
   var readers=ImageIO.getImageReaders(input);
   if(!readers.hasNext())throw invalid("Use the image picker to prepare WebP images, or upload a valid PNG, JPEG or GIF");
   var reader=readers.next();
   try {
    reader.setInput(input,true,true);
    int width=reader.getWidth(0),height=reader.getHeight(0);
    if(width<1||height<1||(long)width*height>40_000_000)throw invalid("Image exceeds 40 megapixels");
    var parameters=reader.getDefaultReadParam();
    int sample=Math.max(1,(int)Math.floor(Math.min(width/(double)MAX_WIDTH,height/(double)MAX_HEIGHT)));
    parameters.setSourceSubsampling(sample,sample,0,0);
    original=reader.read(0,parameters);
   } finally {reader.dispose();}
  } catch (IOException | IllegalArgumentException error) {throw invalid("The image could not be decoded");}
  if(original==null)throw invalid("The image could not be decoded");
  boolean alpha=original.getColorModel().hasAlpha();
  double scale=Math.min(1,Math.min(MAX_WIDTH/(double)original.getWidth(),MAX_HEIGHT/(double)original.getHeight()));
  int width=Math.max(1,(int)Math.round(original.getWidth()*scale)),height=Math.max(1,(int)Math.round(original.getHeight()*scale));
  float quality=.9f;
  while(true) {
   var resized=new BufferedImage(width,height,alpha?BufferedImage.TYPE_INT_ARGB:BufferedImage.TYPE_INT_RGB);
   var graphics=resized.createGraphics();
   graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
   graphics.drawImage(original,0,0,width,height,null);graphics.dispose();
   byte[] bytes=encode(resized,alpha,quality);resized.flush();
   if(bytes.length<=MAX_BYTES){original.flush();return new Image(bytes,alpha?"image/png":"image/jpeg",alpha?".png":".jpg");}
   if(!alpha&&quality>.6f)quality-=.1f;
   else {width=Math.max(1,(int)(width*.85));height=Math.max(1,(int)(height*.85));}
  }
 }
 private static byte[] encode(BufferedImage image,boolean alpha,float quality) throws IOException {
  var output=new ByteArrayOutputStream();
  if(alpha){ImageIO.write(image,"png",output);return output.toByteArray();}
  var writer=ImageIO.getImageWritersByFormatName("jpeg").next();
  try(var stream=new MemoryCacheImageOutputStream(output)) {
   writer.setOutput(stream);var parameters=writer.getDefaultWriteParam();
   parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);parameters.setCompressionQuality(quality);
   writer.write(null,new IIOImage(image,null,null),parameters);
  } finally {writer.dispose();}
  return output.toByteArray();
 }
 private static ResponseStatusException invalid(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
}
