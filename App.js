import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  AppState,
} from 'react-native';
import Sound from 'react-native-sound';
import notifee, {
  TriggerType,
  AndroidImportance,
  AndroidCategory,
} from '@notifee/react-native';

Sound.setCategory('Playback');

export default function App() {
  const initialTimer = { h: 0, m: 0, s: 0, running: false, total: 0 };
  const [timers, setTimers] = useState({
    1: { ...initialTimer },
    2: { ...initialTimer },
    3: { ...initialTimer },
    4: { ...initialTimer },
  });
  const [selected, setSelected] = useState(1);
  const lastTickRef = useRef(Date.now());
  const appStateRef = useRef(AppState.currentState);
  const beepSoundRef = useRef(null);

  // --- SOUND & NOTIFICATION ---
  const playBeep = () => {
    if (beepSoundRef.current) {
      beepSoundRef.current.setNumberOfLoops(-1);
      beepSoundRef.current.play();
    }
  };

  const stopBeep = () => {
    if (beepSoundRef.current) beepSoundRef.current.stop();
    notifee.cancelAllNotifications();
  };

  const scheduleNotification = async (seconds, timerId) => {
    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + seconds * 1000,
    };
    await notifee.createTriggerNotification(
      {
        id: `timer-${timerId}`,
        title: `Timer T${timerId} Finished`,
        body: 'Industrial Alert: Time is up!',
        android: {
          channelId: 'timer-channel',
          category: AndroidCategory.ALARM,
          importance: AndroidImportance.HIGH,
          sound: 'beep',
          looping: true,
        },
      },
      trigger,
    );
  };

  useEffect(() => {
    beepSoundRef.current = new Sound('beep.wav', Sound.MAIN_BUNDLE);
    const setupNotifee = async () => {
      await notifee.createChannel({
        id: 'timer-channel',
        name: 'Timer Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'beep',
      });
    };
    setupNotifee();
    return () => {
      if (beepSoundRef.current) beepSoundRef.current.release();
    };
  }, []);

  // --- MULTI-TIMER INDEPENDENT COUNTDOWN ---
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const updated = { ...prev };
        let stateChanged = false;

        Object.keys(updated).forEach(key => {
          const t = updated[key];
          if (t.running) {
            stateChanged = true;
            if (t.total <= 1) {
              // Timer finished
              notifee.cancelNotification(`timer-${key}`);
              playBeep();
              updated[key] = { ...initialTimer, running: false };
            } else {
              // Decrement
              const newTotal = t.total - 1;
              updated[key] = {
                ...t,
                total: newTotal,
                h: Math.floor(newTotal / 3600),
                m: Math.floor((newTotal % 3600) / 60),
                s: newTotal % 60,
              };
            }
          }
        });

        return stateChanged ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // --- APP STATE CATCH-UP ---
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async nextAppState => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          const elapsedSec = Math.floor(
            (Date.now() - lastTickRef.current) / 1000,
          );

          setTimers(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
              const t = updated[key];
              if (t.running) {
                let newTotal = Math.max(0, t.total - elapsedSec);
                if (newTotal <= 0) {
                  stopBeep();
                  playBeep();
                  updated[key] = { ...initialTimer, running: false };
                } else {
                  updated[key] = {
                    ...t,
                    total: newTotal,
                    h: Math.floor(newTotal / 3600),
                    m: Math.floor((newTotal % 3600) / 60),
                    s: newTotal % 60,
                  };
                }
              }
            });
            return updated;
          });
        }
        lastTickRef.current = Date.now();
        appStateRef.current = nextAppState;
      },
    );
    return () => subscription.remove();
  }, []);

  // --- HANDLERS ---
  const toggleRunning = () => {
    const current = timers[selected];
    const willRun = !current.running;

    stopBeep();

    if (willRun && current.total > 0) {
      scheduleNotification(current.total, selected);
    } else {
      notifee.cancelNotification(`timer-${selected}`);
    }

    setTimers(prev => ({
      ...prev,
      [selected]: { ...prev[selected], running: willRun },
    }));
  };

  const adjustTime = (unit, delta) => {
    setTimers(prev => {
      const t = prev[selected];
      if (t.running) return prev;
      let newVal = Math.max(0, t[unit] + delta);
      const updated = { ...t, [unit]: newVal };
      updated.total = updated.h * 3600 + updated.m * 60 + updated.s;
      return { ...prev, [selected]: updated };
    });
  };

  const current = timers[selected];

  const renderTime = () => {
    const hh = String(current.h).padStart(2, '0');
    const mm = String(current.m).padStart(2, '0');
    const ss = String(current.s).padStart(2, '0');
    if (current.h > 0) {
      return (
        <Text
          style={[styles.lcdText, styles.lcdSmall]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {hh}:{mm}:{ss}
        </Text>
      );
    }
    return (
      <Text
        style={[styles.lcdText, styles.lcdLarge]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {mm}:{ss}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.status}>
          T{selected} {current.running ? 'RUNNING' : 'IDLE'}
        </Text>
        {/* Indicators for background timers */}
        <View style={styles.indicatorRow}>
          {[1, 2, 3, 4].map(n => (
            <View
              key={n}
              style={[styles.dot, timers[n].running && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      <View style={styles.lcd}>{renderTime()}</View>

      <View style={styles.row}>
        {[1, 2, 3, 4].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => setSelected(n)}
            style={[styles.btnSmall, selected === n && styles.btnSelected]}
          >
            <Text style={styles.white}>T{n}</Text>
            {timers[n].running && <View style={styles.runningIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.controlSection}>
        {['s', 'm', 'h'].map(unit => (
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
            stopBeep();
            setTimers(p => ({ ...p, [selected]: { ...initialTimer } }));
          }}
          style={styles.btnClear}
        >
          <Text style={styles.white}>CLEAR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleRunning}
          style={[
            styles.start,
            { backgroundColor: current.running ? '#D32F2F' : '#2E7D32' },
          ]}
        >
          <Text style={styles.white}>{current.running ? 'STOP' : 'START'}</Text>
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
  indicatorRow: { flexDirection: 'row', marginTop: 5 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
    marginHorizontal: 4,
  },
  dotActive: { backgroundColor: '#00FF41' },
  lcd: {
    backgroundColor: '#111',
    height: 140,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#333',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  lcdText: { color: '#00FF41', fontFamily: 'monospace', textAlign: 'center' },
  lcdLarge: { fontSize: 90, fontWeight: 'bold' },
  lcdSmall: { fontSize: 65 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  btnSmall: {
    backgroundColor: '#444',
    paddingVertical: 12,
    width: '22%',
    borderRadius: 10,
    alignItems: 'center',
    position: 'relative',
  },
  btnSelected: {
    backgroundColor: '#0066cc',
    borderWidth: 2,
    borderColor: '#3399ff',
  },
  runningIndicator: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
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
  white: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
});
