/**
 * @file Extra tests for date/time helper functions.
 *
 * Copyright (C) 2010-2022 Adam Nielsen <malvineous@shikadi.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import assert from 'assert';
import {
	fromUnixTime,
	toUnixTime,
	fromFAT16Time,
	toFAT16Time,
} from '../util/datetime.js';

describe(`Extra tests for date/time functions`, function() {

	describe('fromUnixTime()', function() {
		it('works for a normal timestamp', function() {
			assert.equal(
				fromUnixTime(981173106).toISOString(),
				'2001-02-03T04:05:06.000Z'
			);
		});

		it('works for the epoch', function() {
			assert.equal(
				fromUnixTime(0).toISOString(),
				'1970-01-01T00:00:00.000Z'
			);
		});
	});

	describe('toUnixTime()', function() {
		it('works for a normal timestamp', function() {
			assert.equal(
				toUnixTime(new Date('2001-02-03T04:05:06.000Z')),
				981173106
			);
		});

		it('works for the epoch', function() {
			assert.equal(
				toUnixTime(new Date('1970-01-01T00:00:00.000Z')),
				0
			);
		});
	});

	describe('fromFAT16Time()', function() {
		it('works for a normal timestamp', function() {
			assert.equal(
				// The epoch can't be 0 because that would return a day and month of 0,
				// but both these start at 1.
				fromFAT16Time(10819, 8355).toISOString(),
				'2001-02-03T04:05:06.000Z'
			);
		});

		it('works for a normal timestamp', function() {
			assert.equal(
				// The epoch can't be 0 because that would return a day and month of 0,
				// but both these start at 1.
				fromFAT16Time(33, 0).toISOString(),
				'1980-01-01T00:00:00.000Z'
			);
		});
	});

	describe('toFAT16Time()', function() {
		it('works for a normal timestamp', function() {
			assert.deepEqual(
				toFAT16Time(new Date('2001-02-03T04:05:06.000Z')),
				{ date: 10819, time: 8355}
			);
		});

		it('works for the epoch', function() {
			assert.deepEqual(
				toFAT16Time(new Date('1980-01-01T00:00:00.000Z')),
				{ date: 33, time: 0}
			);
		});
	});

});
