import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  AppState,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import Sound from 'react-native-sound';
import notifee, {
  TriggerType,
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
} from '@notifee/react-native';

Sound.setCategory('Playback');

const INITIAL_TIMER_STATE = {
  h: 0,
  m: 0,
  s: 0,
  total: 0,
  running: false,
  alarm: false,
  targetTime: null,
};

export default function App() {
  const [timers, setTimers] = useState({
    1: { ...INITIAL_TIMER_STATE },
    2: { ...INITIAL_TIMER_STATE },
    3: { ...INITIAL_TIMER_STATE },
    4: { ...INITIAL_TIMER_STATE },
  });
  const [selected, setSelected] = useState(1);
  const [isBlinkVisible, setIsBlinkVisible] = useState(true);

  const appState = useRef(AppState.currentState);
  const beepSoundRef = useRef(null);

  useEffect(() => {
    async function setup() {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      }
      await notifee.requestPermission();

      // IMPORTANT: Create the channel with the sound name (no extension)
      await notifee.createChannel({
        id: 'timer-channel',
        name: 'Timer Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'beep', // Refers to android/app/src/main/res/raw/beep.wav
        visibility: AndroidVisibility.PUBLIC,
      });
    }

    const sound = new Sound('beep.wav', Sound.MAIN_BUNDLE, error => {
      if (!error) beepSoundRef.current = sound;
    });

    setup();
    return () => {
      if (beepSoundRef.current) beepSoundRef.current.release();
    };
  }, []);

  const playBeepJS = () => {
    if (beepSoundRef.current) {
      beepSoundRef.current.setNumberOfLoops(-1);
      beepSoundRef.current.play();
    }
  };

  const stopAllSounds = () => {
    if (beepSoundRef.current) beepSoundRef.current.stop();
  };

  // Sync Engine: Catches up when you re-open the app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        const now = Date.now();
        setTimers(prev => {
          const updated = { ...prev };
          let shouldPlayBeep = false;
          Object.keys(updated).forEach(key => {
            const t = updated[key];
            if (t.running && t.targetTime) {
              const remaining = Math.round((t.targetTime - now) / 1000);
              if (remaining <= 0) {
                updated[key] = {
                  ...t,
                  running: false,
                  total: 0,
                  h: 0,
                  m: 0,
                  s: 0,
                  alarm: true,
                };
                shouldPlayBeep = true;
              } else {
                updated[key] = {
                  ...t,
                  total: remaining,
                  h: Math.floor(remaining / 3600),
                  m: Math.floor((remaining % 3600) / 60),
                  s: remaining % 60,
                };
              }
            }
          });
          if (shouldPlayBeep) playBeepJS();
          return updated;
        });
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  // UI Tick
  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinkVisible(v => !v);
      setTimers(prev => {
        const updated = { ...prev };
        let changed = false;
        Object.keys(updated).forEach(key => {
          const t = updated[key];
          if (t.running) {
            changed = true;
            if (t.total <= 1) {
              playBeepJS();
              updated[key] = {
                ...t,
                running: false,
                total: 0,
                h: 0,
                m: 0,
                s: 0,
                alarm: true,
              };
            } else {
              const nextTotal = t.total - 1;
              updated[key] = {
                ...t,
                total: nextTotal,
                h: Math.floor(nextTotal / 3600),
                m: Math.floor((nextTotal % 3600) / 60),
                s: nextTotal % 60,
              };
            }
          }
        });
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleRunning = async () => {
    const t = timers[selected];
    if (t.alarm) {
      const others = Object.keys(timers).some(
        k => k !== selected.toString() && timers[k].alarm,
      );
      if (!others) stopAllSounds();
      notifee.cancelNotification(`timer-${selected}`);
      setTimers(prev => ({
        ...prev,
        [selected]: { ...prev[selected], alarm: false },
      }));
      return;
    }

    if (!t.running && t.total > 0) {
      const target = Date.now() + t.total * 1000;

      // BACKGROUND ENGINE: Native Notification
      await notifee.createTriggerNotification(
        {
          id: `timer-${selected}`,
          title: `Timer T${selected} Finished`,
          body: 'Industrial Alert: Time is up!',
          android: {
            channelId: 'timer-channel',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.ALARM,
            sound: 'beep', // Play natively in background
            pressAction: { id: 'default' },
            fullScreenAction: { id: 'default' },
          },
        },
        { type: TriggerType.TIMESTAMP, timestamp: target, alarmManager: true },
      );

      setTimers(prev => ({
        ...prev,
        [selected]: { ...t, running: true, targetTime: target },
      }));
    } else {
      notifee.cancelNotification(`timer-${selected}`);
      setTimers(prev => ({
        ...prev,
        [selected]: { ...t, running: false, targetTime: null },
      }));
    }
  };

  const adjustTime = (unit, delta) => {
    setTimers(prev => {
      const t = prev[selected];
      if (t.running || t.alarm) return prev;
      const newVal = Math.max(0, t[unit] + delta);
      const updated = { ...t, [unit]: newVal };
      updated.total = updated.h * 3600 + updated.m * 60 + updated.s;
      return { ...prev, [selected]: updated };
    });
  };

  const current = timers[selected];
  const textColor = current.alarm && isBlinkVisible ? '#FF0000' : '#00FF41';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.status}>
          T{selected}{' '}
          {current.alarm
            ? '!!! ALARM !!!'
            : current.running
            ? 'RUNNING'
            : 'IDLE'}
        </Text>
      </View>
      <View
        style={[
          styles.lcd,
          current.alarm && isBlinkVisible && styles.lcdAlarmBorder,
        ]}
      >
        <Text
          style={[
            styles.lcdText,
            current.h > 0 ? styles.lcdSmall : styles.lcdLarge,
            { color: textColor },
          ]}
        >
          {current.h > 0
            ? `${String(current.h).padStart(2, '0')}:${String(
                current.m,
              ).padStart(2, '0')}:${String(current.s).padStart(2, '0')}`
            : `${String(current.m).padStart(2, '0')}:${String(
                current.s,
              ).padStart(2, '0')}`}
        </Text>
      </View>
      <View style={styles.row}>
        {[1, 2, 3, 4].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => setSelected(n)}
            style={[
              styles.btnSmall,
              {
                backgroundColor:
                  selected === n
                    ? '#0066cc'
                    : timers[n].alarm && isBlinkVisible
                    ? '#FF0000'
                    : '#444',
              },
            ]}
          >
            <Text style={styles.white}>T{n}</Text>
            {timers[n].running && !timers[n].alarm && (
              <View style={styles.runningIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.controlSection}>
        {['h', 'm', 's'].map(unit => (
          <View key={unit} style={styles.adjustmentRow}>
            <Text style={styles.unitLabel}>{unit.toUpperCase()}</Text>
            <TouchableOpacity
              onPress={() => adjustTime(unit, -1)}
              style={styles.adjBtn}
            >
              <Text style={styles.white}>-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => adjustTime(unit, 1)}
              style={styles.adjBtn}
            >
              <Text style={styles.white}>+</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
      <View style={styles.footerRow}>
        <TouchableOpacity
          onPress={() => {
            if (current.alarm) stopAllSounds();
            setTimers(p => ({ ...p, [selected]: { ...INITIAL_TIMER_STATE } }));
          }}
          style={styles.btnClear}
        >
          <Text style={styles.white}>CLEAR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleRunning}
          style={[
            styles.start,
            {
              backgroundColor:
                current.running || current.alarm ? '#D32F2F' : '#2E7D32',
            },
          ]}
        >
          <Text style={styles.white}>
            {current.alarm ? 'STOP ALARM' : current.running ? 'STOP' : 'START'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 20,
  },
  header: { alignItems: 'center', marginBottom: 10 },
  status: { color: '#AAA', fontSize: 18, fontWeight: 'bold' },
  lcd: {
    backgroundColor: '#111',
    height: 140,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#333',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lcdAlarmBorder: { borderColor: '#FF0000' },
  lcdText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  lcdLarge: { fontSize: 90, fontWeight: 'bold' },
  lcdSmall: { fontSize: 65 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  btnSmall: {
    paddingVertical: 12,
    width: '22%',
    borderRadius: 10,
    alignItems: 'center',
  },
  runningIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FF41',
  },
  controlSection: { marginBottom: 10 },
  adjustmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    marginBottom: 8,
    borderRadius: 10,
    padding: 8,
  },
  unitLabel: { color: '#FFF', fontSize: 18, fontWeight: 'bold', width: 50 },
  adjBtn: {
    backgroundColor: '#333',
    flex: 1,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
    borderRadius: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  btnClear: {
    backgroundColor: '#555',
    height: 70,
    width: '35%',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  start: {
    height: 70,
    width: '60%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  white: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
});
