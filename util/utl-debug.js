/**
 * @file Debugging helper functions.
 *
 * Copyright (C) 2018 Adam Nielsen <malvineous@shikadi.net>
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

let state = {
	mute: true,
	prefix: [],
};

module.exports = class Debug {
	static push(...items) {
		state.prefix.push(items.join('/'));
		this.renderPrefix();
	}

	static pop() {
		state.prefix.pop();
		this.renderPrefix();
	}

	static renderPrefix() {
		state.renderedPrefix = '[' + state.prefix.join('/') + ']';
	}

	static log(...params) {
		if (!state.mute) console.debug(state.renderedPrefix, ...params);
	}

	static mute(m) {
		state.mute = m;
	}

	static get enabled() {
		return !state.mute;
	}
};
