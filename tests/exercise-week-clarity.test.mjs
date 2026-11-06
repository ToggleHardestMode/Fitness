import test from 'node:test';
import assert from 'node:assert/strict';
import {mondayOf} from '../preview-v101/week-window.js';
test('week starts Monday',()=>assert.equal(mondayOf('2026-11-06'),'2026-11-02'));
