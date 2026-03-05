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
  const initialTimer = {
    h: 0,
    m: 0,
    s: 0,
    running: false,
    total: 0,
    alarm: false,
  };
  const [timers, setTimers] = useState({
    1: { ...initialTimer },
    2: { ...initialTimer },
    3: { ...initialTimer },
    4: { ...initialTimer },
  });
  const [selected, setSelected] = useState(1);
  const [isBlinkVisible, setIsBlinkVisible] = useState(true);

  const lastTickRef = useRef(Date.now());
  const appStateRef = useRef(AppState.currentState);
  const beepSoundRef = useRef(null);

  // Initial Setup
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

  // Blinking Effect (500ms)
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinkVisible(prev => !prev);
    }, 500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Countdown Loop
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
              notifee.cancelNotification(`timer-${key}`);
              playBeep();
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

  const playBeep = () => {
    if (beepSoundRef.current) {
      beepSoundRef.current.setNumberOfLoops(-1);
      beepSoundRef.current.play();
    }
  };

  // --- CORE CHANGE: FUNCTION TO STOP ALARM ---
  const stopAlarmLogic = timerId => {
    // 1. Check if any OTHER timers are still alarming
    const otherAlarms = Object.keys(timers).some(
      k => k !== timerId.toString() && timers[k].alarm,
    );

    // 2. If no other timers are alarming, kill the sound
    if (!otherAlarms) {
      if (beepSoundRef.current) beepSoundRef.current.stop();
      notifee.cancelAllNotifications();
    }

    // 3. Reset only the alarm state for this specific timer
    setTimers(prev => ({
      ...prev,
      [timerId]: { ...prev[timerId], alarm: false },
    }));
  };

  const toggleRunning = () => {
    const current = timers[selected];

    // If it's beeping, this button is "STOP ALARM"
    if (current.alarm) {
      stopAlarmLogic(selected);
      return;
    }

    // Normal Start/Stop toggle
    const willRun = !current.running;
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

  const clearTimer = () => {
    const current = timers[selected];
    // If user clears while alarming, we must stop the sound too
    if (current.alarm) {
      stopAlarmLogic(selected);
    }

    setTimers(prev => ({
      ...prev,
      [selected]: { ...initialTimer },
    }));
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
          importance: AndroidImportance.HIGH,
          sound: 'beep',
          looping: true,
        },
      },
      trigger,
    );
  };

  const adjustTime = (unit, delta) => {
    setTimers(prev => {
      const t = prev[selected];
      if (t.running || t.alarm) return prev;
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
    const showRed = current.alarm && isBlinkVisible;
    const textColor = showRed ? '#FF0000' : '#00FF41';

    if (current.h > 0) {
      return (
        <Text
          style={[styles.lcdText, styles.lcdSmall, { color: textColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {hh}:{mm}:{ss}
        </Text>
      );
    }
    return (
      <Text
        style={[styles.lcdText, styles.lcdLarge, { color: textColor }]}
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
        {renderTime()}
      </View>

      <View style={styles.row}>
        {[1, 2, 3, 4].map(n => {
          const isAlarming = timers[n].alarm;
          const isSelected = selected === n;
          let bgColor = '#444';
          if (isSelected) bgColor = '#0066cc';
          if (isAlarming && isBlinkVisible) bgColor = '#FF0000';

          return (
            <TouchableOpacity
              key={n}
              onPress={() => setSelected(n)}
              style={[
                styles.btnSmall,
                { backgroundColor: bgColor },
                isSelected && styles.btnSelectedBorder,
              ]}
            >
              <Text style={styles.white}>T{n}</Text>
              {timers[n].running && !timers[n].alarm && (
                <View style={styles.runningIndicator} />
              )}
            </TouchableOpacity>
          );
        })}
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
        <TouchableOpacity onPress={clearTimer} style={styles.btnClear}>
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
    paddingHorizontal: 10,
  },
  lcdAlarmBorder: { borderColor: '#FF0000' },
  lcdText: { fontFamily: 'monospace', textAlign: 'center' },
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
    position: 'relative',
  },
  btnSelectedBorder: { borderWidth: 2, borderColor: '#3399ff' },
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
