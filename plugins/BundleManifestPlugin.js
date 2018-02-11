const path = require('path');
const fs = require('fs');

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

  bundler.on('bundled', (bundle) => {
    const basename = bundle.entryAsset.generateBundleName();
    const filepath = bundle.entryAsset.name;
    const hash = bundle.entryAsset.hash;
    const type = bundle.entryAsset.type;

    const dir = bundle.entryAsset.options.outDir;

    const manifestPath = path.resolve(dir, 'parcel-manifest.json');
    const manifestValue = readManifestJson(manifestPath);

    manifestValue[basename] = hash + '.' + type;
    const origPath = path.join(dir, basename);
    if (fs.existsSync(origPath)) {
      fs.renameSync(origPath, path.join(dir, hash + '.' + type));
    }

    logger.status('📦', 'PackageManifestPlugin');
    logger.status('📄', `manifest : ${manifestPath}`);

    fs.writeFileSync(manifestPath, JSON.stringify(manifestValue));
  });
};
