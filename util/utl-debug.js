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
};
