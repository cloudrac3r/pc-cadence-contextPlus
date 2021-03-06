const { Plugin } = require('powercord/entities');
const { getModuleByDisplayName } = require('powercord/webpack');
const { inject, uninject } = require('powercord/injector');
const waitFor = require('powercord/util/waitFor')
const getOwnerInstance = require('powercord/util/getOwnerInstance')

function sd(object, path) {
	let fragments = path.split(".");
	for (let fragment of fragments) {
		object = object && object[fragment];
	}
	return object;
}


const cmcontrol = {
	generic: {
		/**
		 * Find an item from an array of context menu items.
		 * @param {Object[]} arr
		 * @param {String} name
		 * @returns {?Object} The found item, or `undefined`
		 */
		find: (arr, name) => {
			return arr.find(g => g && g.type.displayName == name);
		},
		/**
		 * Return an array of matching items from an array of context menu items.
		 * @param {Object[]} arr
		 * @param {String} name
		 * @returns {Object[]}
		 */
		filter: (arr, name) => {
			return arr.filter(g => g && g.type.displayName == name);
		},
		/**
		 * Return the index of matching context menu items.
		 * @param {Object[]} arr
		 * @param {String} name
		 * @param {Boolean} all Whether to return multiple matches
		 * @returns {(Number|Number[])} The index of the found item, or `undefined`, or an array of found indexes
		 */
		indexOf: (arr, name, all = false) => {
			let filtered = arr.map((g, i) => ({g, i})).filter(o => o.g && o.g.type.displayName == name).map(o => o.i);
			return all ? filtered : filtered[0];
		},
		summary: arr => {
			return arr && [].concat(...arr.map(g => [sd(g, "type.displayName"), g]));
		},
		/**
		 * Remove matching items from an array of context menu items. Operates in-place.
		 * @param {Object[]} arr
		 * @param {String} name
		 * @param {Boolean} all Whether to return multiple matches
		 * @param {Boolean} nullify Whether to set to null rather than splice
		 * @returns {Object[]} The modified array
		 */
		remove: (arr, name, all = true, nullify = true) => {
			let indexes = cmcontrol.generic.indexOf(arr, name, true);
			if (all) indexes = [indexes[0]];
			indexes.reverse().forEach(i => {
				if (nullify) arr[i] = null;
				else arr.splice(i, 1)
			});
		},
		/**
		 * Remove matching items from an array of context menu items. Operates in-place.
		 * @param {Object[]} arr
		 * @param {String} name
		 * @param {Object} dest Table or array to send the item to
		 * @param {?Number} position Position to insert into. `null` to insert at end.
		 * @param {Boolean} all Whether to return multiple matches
		 * @param {Boolean} nullify Whether to set to null rather than splice
		 * @returns {Object[]} The modified array
		 */
		moveTo: (arr, name, dest, position = null, all = true, nullify = true) => {
			let indexes = cmcontrol.generic.indexOf(arr, name, true);
			if (all) indexes = [indexes[0]];
			if (dest.constructor.name != "Array") dest = cmcontrol.generic.extractItems(dest);
			indexes.reverse().forEach(i => {
				if (position === null) dest.push(arr[i]);
				else dest.splice(position, 0, arr[1]);
				if (nullify) arr[i] = null;
				else arr.splice(i, 1);
			});
		},
		/**
		 * Get the children of a table
		 * @param {Object} table
		 * @returns {Object[]} The table's children
		 */
		extractItems: table => {
			return table.props.children;
		},
		/*onAllChildren: (input, callback) => {
			if (input.constructor.name == "Array") {
				// input is an array of tables
				return input.map(table => cmcontrol.generic.onAllChildren(table, callback));
			} else {
				// input is a table
				return cmcontrol.generic.extractItems(input).map(item => callback(item));
			}
		}*/
		fillName: (item, name) => {
			item.type.displayName = name;
		},
		/**
		 * Go down a tree of items.
		 * @param {Object} item
		 * @param {String} path A dot-separated path of children
		 * @returns {Object}
		 */
		tree: (item, path) => {
			let fragments = path.split(".");
			for (let fragment of fragments) {
				item = cmcontrol.generic.extractItems(item);
				if (fragment) item = item[fragment];
			}
			return item;
		}
	},
	res: {
		extractGroups: res => {
			return res.props.children.props.children.props.children;
		}
	},
	resguild: {
		extractGroups: res => {
			return res.props.children;
		}
	}
}

const Settings = require('./Settings.jsx');

module.exports = class ContextPlus extends Plugin {
	startPlugin() {
		this.registerSettings('cadence-contextPlus', 'Context+', Settings);

		// Default settings
		this.settings.set("patchUser", this.settings.get("patchUser", true));
		this.settings.set("patchGuild", this.settings.get("patchGuild", true));

		this._patchContextMenu();
	}

	pluginWillUnload() {
		uninject('cadence-cp-userContextMenu');
		uninject('cadence-cp-guildContextMenu');
	}

	async _patchContextMenu() {
		const _this = this

		const menu = await waitFor(".contextMenu-HLZMGh")
		if (menu.textContent.startsWith("ProfileMentionMessageCall")) {
			const res = getOwnerInstance(menu)
			inject("cadence-cp-userContextMenu", res.__proto__, "render", function(_, res) {
				;(() => { // returning inside here should not exit render

					if (_this.settings.get("patchUser")) {
						res = res.props.children(this) // ????????
						//console.log("res", res);

						//console.log("groups", [].concat(...groups.map(g => [g.type.displayName, g])));

						//console.log("items");
						//groups.forEach(g => {
						//	if (g.props.children) console.log(g.props.children.map(c => c.type.displayName));
						//});

						//let index = cmcontrol.generic.indexOf(groups, "MenuGroup", true)[0];
						//console.log(index, groups[index]);

						let groups
						try {
							groups = cmcontrol.res.extractGroups(res);
							if (!(
								groups[0].props.children[0].type.displayName === "UserProfileItem"
								&& groups[0].props.children[1].type.displayName === "UserMentionItem"
							)) return
						} catch (e) {
							return
						}
						if (groups[1].type.displayName != "UserVolumeGroup") {
							cmcontrol.generic.fillName(cmcontrol.generic.tree(groups[1], "1"), "c-InviteToServer");
							cmcontrol.generic.fillName(cmcontrol.generic.tree(groups[1], "2"), "c-ShowOnActivityFeed");
							//cmcontrol.generic.remove(cmcontrol.generic.extractItems(groups[1]), "c-ShowOnActivityFeed");
							groups.forEach(group => {
								let items = cmcontrol.generic.extractItems(group);
								if (items) {
									console.log("summary", cmcontrol.generic.summary(items));
									["UserCallItem", "UserNoteItem", "c-ShowOnActivityFeed", "UserStreamItem"].forEach(toRemove => {
										cmcontrol.generic.remove(items, toRemove);
									});
									["c-InviteToServer", "UserAddFriendItem", "UserBlockItem"].forEach(toMove => {
										cmcontrol.generic.moveTo(items, toMove, groups[0]);
									});
								}
							});
							groups[2] = null;
						} else if (groups[2].props.children[0] != null) {
							cmcontrol.generic.fillName(cmcontrol.generic.tree(groups[2], "0"), "c-Mute");
							cmcontrol.generic.fillName(cmcontrol.generic.tree(groups[2], "1"), "c-ChangeNickname");
							cmcontrol.generic.fillName(cmcontrol.generic.tree(groups[2], "2"), "c-InviteToServer");
							cmcontrol.generic.fillName(cmcontrol.generic.tree(groups[2], "3"), "c-ShowOnActivityFeed");
							groups.forEach(group => {
								let items = cmcontrol.generic.extractItems(group);
								if (items) {
									console.log("summary", cmcontrol.generic.summary(items));
									["UserCallItem", "UserNoteItem", "c-ShowOnActivityFeed", "UserStreamItem"].forEach(toRemove => {
										cmcontrol.generic.remove(items, toRemove);
									});
									["c-InviteToServer", "c-Mute", "UserAddFriendItem", "UserBlockItem"].forEach(toMove => {
										cmcontrol.generic.moveTo(items, toMove, groups[0]);
									});
								}
							});
						}
					}

				})()
				return res
			})
		}
		/*
		const GuildContextMenu = await getModuleByDisplayName('GuildContextMenu');
		inject('cadence-cp-guildContextMenu', GuildContextMenu.prototype, 'render', (_, res) => {
			if (this.settings.get("patchGuild")) {
				//console.log("res", res);

				/*console.log("groups", [].concat(...groups.map(g => [g.type.displayName, g])));

				console.log("items");
				groups.forEach(g => {
					if (g.props.children) console.log(g.props.children.map(c => c.type.displayName));
				});
				*//*

				let groups = cmcontrol.resguild.extractGroups(res);

				groups.forEach((group, index) => {
					let items = cmcontrol.generic.extractItems(group);
					if (items && (items instanceof Array)) {
						if (index == 2) items.fill(null); // create channel and create category is always in group index 2

						let toRemove = [];
						toRemove.unshift(cmcontrol.generic.indexOf(items, "GuildPrivacySettingsItem")); // privacy settings
						toRemove.unshift(toRemove[0]+1); // change nickname
						let muteIndex = cmcontrol.generic.indexOf(items, "GuildMuteItem"); // mute server (this isn't actually removed)
						toRemove.unshift(muteIndex+1); // hide muted channels

						toRemove.forEach(index => {
							items[index] = null;
						});
					}
				});
			}

			return res;
		});*/
	}
};
