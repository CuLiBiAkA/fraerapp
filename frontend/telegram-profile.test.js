import test from 'node:test';
import assert from 'node:assert/strict';
import { profileLabel } from './telegram-profile.js';

test('profile shows Telegram name and username and retains ordinary email fallback', () => {
  assert.equal(profileLabel({displayName:'Анна Иванова',telegramUsername:'anna'}), 'Анна Иванова · @anna');
  assert.equal(profileLabel({displayName:'@anna',telegramUsername:'anna'}), '@anna');
  assert.equal(profileLabel({displayName:'Анна',telegramUsername:''}), 'Анна');
  assert.equal(profileLabel({email:'reader@example.test'}), 'reader@example.test');
  assert.equal(profileLabel({email:'telegram-123@telegram.fraerapp.local'}), 'Telegram');
  assert.equal(profileLabel(null), '');
});
