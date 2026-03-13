// SoundMock.js
export default class Sound {
  constructor(url, path, callback) {
    console.log('Sound mock initialized for:', url);
    if (callback) callback();
  }
  play(callback) {
    console.log('Playing sound (mock)');
    if (callback) callback();
  }
  stop() {}
  release() {}
  setVolume() {}
  setNumberOfLoops() {}
}
Sound.setCategory = () => {};
