function stringify(obj, replacer, spaces, cycleReplacer) {
  return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
}

function serializer(replacer, cycleReplacer) {
  var stack = [], keys = []

  if (cycleReplacer == null) cycleReplacer = function (key, value) {
    if (stack[0] === value) return "[Circular ~]"
    return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]"
  }

  return function (key, value) {
    if (stack.length > 0) {
      var thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
    }
    else stack.push(value)

    return replacer == null ? value : replacer.call(this, key, value)
  }
}

const path = require('path');
const fs = require('fs');
const hasha = require('hasha');

module.exports = function (bundler) {
  const logger = bundler.logger;

  /**
   * Read the paths already registered within the manifest.json
   * @param {string} path 
   * @returns {Object}
   */
  const readManifestJson = (path) => {
    if (!fs.existsSync(path)) {
      logger.status('✨', 'create manifest file');
      return {};
    };

    logger.status('🖊', 'update manifest file');

    try {
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (e) {
      logger.error('manifest file is invalid');
      throw e;
    }
  };

  const collectHashes = (bundle) => {
    return Array.from(bundle.assets).map(asset => asset.hash).join('');
  };

  const addToManifest = (bundle, manifest, rootName) => {
    const basename = bundle.entryAsset.generateBundleName();
    const filepath = bundle.entryAsset.name;
    const type = bundle.entryAsset.type;
    const dir = bundle.entryAsset.options.outDir;

    const origPath = path.join(dir, basename);
    const hash = hasha(bundle.entryAsset.hash + Array.from(bundle.assets).map(asset => asset.hash).join(''), { algorithm: 'md5' });

    manifest[bundle.entryAsset.generateBundleName()] = `${rootName}.${hash}.${type}`;

    bundle.childBundles.forEach((bundle) => {
      addToManifest(bundle, manifest, rootName);
    });

    return manifest;
  };

  bundler.on('bundled', (bundle) => {
    const dir = bundle.entryAsset.options.outDir;

    const manifestPath = path.resolve(dir, 'parcel-manifest.json');
    const manifestValue = readManifestJson(manifestPath);

    const rootFile = bundle.entryAsset.generateBundleName().split('.');
    const rootName = rootFile.slice(0, rootFile.length - 1).join('.');

    let newManifest = addToManifest(bundle, {}, rootName);
    Object.keys(newManifest).forEach(fName => {
      const p = path.join(dir, fName);
      const pNew = path.join(dir, newManifest[fName]);
      let c = fs.readFileSync(p, 'utf8');
      Object.keys(newManifest).forEach(fName => {
        c = c.replace(fName, newManifest[fName]);
      });
      fs.writeFileSync(p, c);
      fs.renameSync(p, pNew);
    });

    logger.status('📦', 'PackageManifestPlugin');
    logger.status('📄', `manifest : ${manifestPath}`);

    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifestValue, ...newManifest }));
  });
};
