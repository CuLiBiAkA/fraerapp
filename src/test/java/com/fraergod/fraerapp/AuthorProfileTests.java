package com.fraergod.fraerapp;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={"spring.datasource.url=jdbc:h2:mem:authorprofiles;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=validate","app.assets.storage-path=build/test-uploads/author-profiles"})
class AuthorProfileTests extends ApiTestSupport {
 @LocalServerPort int port;
 @Test void avatarUploadsAreNormalizedAndPrivateUntilProfileIsPublic() throws Exception {
  String token=TestJwtFactory.author("avatar-author@example.test");
  var bytes=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2,2,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",bytes);
  String boundary="profile-avatar-test";
  var body=new java.io.ByteArrayOutputStream();body.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"file\"; filename=\"avatar.png\"\r\nContent-Type: image/png\r\n\r\n").getBytes());body.write(bytes.toByteArray());body.write(("\r\n--"+boundary+"--\r\n").getBytes());
  var request=java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://localhost:"+port+"/api/author/profile/avatar")).header("Authorization","Bearer "+token).header("Content-Type","multipart/form-data; boundary="+boundary).POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
  var uploaded=java.net.http.HttpClient.newHttpClient().send(request,java.net.http.HttpResponse.BodyHandlers.ofString());
  assertThat(uploaded.statusCode()).as(uploaded.body()).isEqualTo(200);String url=object(uploaded.body()).get("url").toString();
  assertThat(api(port,"GET",url,null,token).statusCode()).isEqualTo(200);
  assertThat(api(port,"GET",url,null,null).statusCode()).isEqualTo(404);
  var profile=Map.of("nickname","Аватар","avatar",url,"biography","","links",List.of());
  assertThat(api(port,"PUT","/api/author/profile",body(profile),token).statusCode()).isEqualTo(200);
  assertThat(api(port,"PUT","/api/author/profile",body(profile),TestJwtFactory.author("avatar-other@example.test")).statusCode()).isEqualTo(400);
 }
 @Test void profileIsOptInOwnedAndValidatesLinksAndImages(){
  String a=TestJwtFactory.author("profile-a@example.test"),b=TestJwtFactory.author("profile-b@example.test");
  var first=api(port,"GET","/api/author/profile",null,a);assertThat(first.statusCode()).isEqualTo(200);
  var p=object(first.body());String id=p.get("id").toString();assertThat(p.get("nickname")).isEqualTo("");
  assertThat(api(port,"GET","/api/author/profile",null,null).statusCode()).isEqualTo(401);
  assertThat(api(port,"GET","/api/author/profile",null,TestJwtFactory.player("profile-reader@example.test")).statusCode()).isEqualTo(403);
  Map<String,Object> data=new HashMap<>(Map.of("id","another-person","nickname","Лисса","biography","Уютные истории","avatar","","links",List.of(Map.of("label","Telegram","url","https://t.me/lissa"))));
  assertThat(api(port,"PUT","/api/author/profile",body(data),a).statusCode()).isEqualTo(200);
  assertThat(object(api(port,"GET","/api/author/profile",null,a).body())).containsEntry("nickname","Лисса").containsEntry("id",id);
  assertThat(object(api(port,"GET","/api/author/profile",null,b).body()).get("nickname")).isEqualTo("");
  assertThat(api(port,"GET","/api/authors/"+id,null,b).statusCode()).isEqualTo(404);
  assertThat(api(port,"GET","/api/authors/"+id,null,null).statusCode()).isEqualTo(404);
  var own=api(port,"GET","/api/authors/"+id,null,a);assertThat(own.statusCode()).as(own.body()).isEqualTo(200);assertThat(object(own.body()).get("works")).isEqualTo(List.of());
  data.put("links",List.of(Map.of("label","Bad","url","javascript:alert(1)")));assertThat(api(port,"PUT","/api/author/profile",body(data),a).statusCode()).isEqualTo(400);
  data.put("links",List.of());data.put("avatar","/uploads/another/person.png");assertThat(api(port,"PUT","/api/author/profile",body(data),a).statusCode()).isEqualTo(400);
  data.put("avatar","");data.put("nickname","a".repeat(61));assertThat(api(port,"PUT","/api/author/profile",body(data),a).statusCode()).isEqualTo(400);
  assertThat(object(api(port,"GET","/api/author/profile",null,a).body()).get("nickname")).isEqualTo("Лисса");
 }
}
