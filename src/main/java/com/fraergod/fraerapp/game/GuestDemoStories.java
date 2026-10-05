package com.fraergod.fraerapp.game;

import java.util.List;

final class GuestDemoStories {
 static final List<String> KEYS = List.of("kak_shodit_v_tualet_pravilno", "kak_pogladit_kota_ne_ubiv", "night_train");
 private GuestDemoStories() {}
 static boolean includes(String key) { return KEYS.contains(key); }
}
