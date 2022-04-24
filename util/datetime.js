/*
 * Date/time support functions.
 *
 * Copyright (C) 2010-2021 Adam Nielsen <malvineous@shikadi.net>
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

const tzOffset = new Date().getTimezoneOffset() * 60;

export function fromUnixTime(u)
{
	// The file's last-modified time is in local time, but when we create
	// a date object from a UNIX timestamp it's assumed to be in UTC.  So
	// we have to add the local timezone onto it to keep it as local time.
	const unixTimeUTC = u + tzOffset;

	return new Date(unixTimeUTC * 1000);
}

export function toUnixTime(d)
{
	// Since the archive does not store a timezone, we assume, like DOS, that
	// the times are local time on the current PC.
	// Since Date.now() returns time since UTC 1970, we need to add the local
	// timezone onto that so that to convert it into seconds since 1970 local
	// time.
	return d.valueOf() / 1000 - tzOffset;
}

export function fromFAT16Time(date, time)
{
	const d = date & 0x1F;
	const m = (date >> 5) & 0x0F; // 1 = Jan
	const y = date >> 9; // years since 1980
	const ss = time & 0x1F; // seconds ÷ 2
	const mm = (time >> 5) & 0x3F;
	const hh = time >> 11;

	return new Date(1980 + y, m - 1, d, hh, mm, ss * 2);
}

export function toFAT16Time(d)
{
	return {
		date: (
			d.getDate()
			| ((d.getMonth() + 1) << 5)
			| ((d.getFullYear() - 1980) << 9)
		),
		time: (
			((d.getSeconds() / 2) >>> 0)
			| (d.getMinutes() << 5)
			| (d.getHours() << 11)
		),
	};
}
