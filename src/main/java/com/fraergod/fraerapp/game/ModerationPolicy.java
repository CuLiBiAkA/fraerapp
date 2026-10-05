package com.fraergod.fraerapp.game;

import java.util.List;
import static com.fraergod.fraerapp.game.WorkLinksService.bad;

/** Identical current-role and self-review requirements for executable stories and collections. */
final class ModerationPolicy {
 private ModerationPolicy() {}
 static void authorizeDecision(AuthIdentity actor,boolean own,String action,Boolean override) {
  if(!actor.hasRole("admin")&&!actor.hasRole("moderator"))throw new ForbiddenRoleException();
  if(own&&List.of("approve","approve-publish","publish-approved","restore","visibility").contains(action)
     &&(!actor.hasRole("admin")||!Boolean.TRUE.equals(override)))throw new ForbiddenRoleException();
 }
 static String reason(String value,boolean required){String s=value==null?"":value.strip();if(s.length()>2000||(required&&s.isEmpty()))throw bad("A reason of 1–2000 characters is required");return s;}
}
