const path = require('path');
const fs = require('fs');
const hasha = require('hasha');

module.exports = function (bundler) {
  const logger = bundler.logger;
  const isProduction = bundler.options.production || process.env.NODE_ENV === 'production';

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
    const asset = bundle.entryAsset ? bundle.entryAsset : bundle.assets.values().next().value;
    const type = asset.type;
    const dir = asset.options.outDir;

    let basename = asset.generateBundleName();

    if (type === 'css') {
      basename = rootName + '.css';
    }

    if (!isProduction) {
      manifest[basename] = basename;
    }
    else {
      const hash = hasha(asset.hash + Array.from(bundle.assets).map(asset => asset.hash).join(''), { algorithm: 'md5' });
      manifest[basename] = `${rootName}.${hash}.${type}`;
    }

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
    if (isProduction) {
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
    }

    logger.status('📦', 'PackageManifestPlugin');
    logger.status('📄', `manifest : ${manifestPath}`);

    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifestValue, ...newManifest }));
  });
};
