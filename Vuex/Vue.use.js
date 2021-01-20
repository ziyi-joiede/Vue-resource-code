// 重点是执行 plugin.install 或者 plugin

Vue.use = function(plugin) {

    const installedPlugins = this._installedPlugins || (this._installedPlugins = []);

    if (installedPlugins.indexOf(plugin) > -1) {
        return this;
    }

    const args = [].slice.call(arguments, 1);
    args.unshift(this);

    if (typeof plugin.install === 'function') {
        plugin.install.apply(plugin, args);
    } else if (typeof plugin === 'function') {
        plugin.apply(null, args);
    }

    installedPlugins.push(plugin);

    return this;

}