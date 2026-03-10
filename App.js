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
  EventType,
} from '@notifee/react-native';

Sound.setCategory('Playback');

const initialTimer = {
  h: 0,
  m: 0,
  s: 0,
  running: false,
  total: 0,
  startTimestamp: null,
  pausedRemaining: 0,
  alarm: false,
};

export default function App() {
  const [timers, setTimers] = useState({
    1: { ...initialTimer },
    2: { ...initialTimer },
    3: { ...initialTimer },
    4: { ...initialTimer },
  });

  const [selected, setSelected] = useState(1);
  const [isBlinkVisible, setIsBlinkVisible] = useState(true);
  const appStateRef = useRef(AppState.currentState);
  const beepSoundRef = useRef(null);

  // Setup sound + Notifee channel + foreground event listener
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

    // Optional: Handle notification interactions when app is foreground
    const unsubscribeForeground = notifee.onForegroundEvent(
      ({ type, detail }) => {
        switch (type) {
          case EventType.PRESS:
            console.log(
              'Notification pressed while foreground:',
              detail.notification?.id,
            );
            // You could e.g. setSelected based on timer ID from notification id
            break;
          case EventType.DISMISSED:
            console.log('Notification dismissed');
            break;
          default:
            break;
        }
      },
    );

    return () => {
      if (beepSoundRef.current) beepSoundRef.current.release();
      unsubscribeForeground();
    };
  }, []);

  // Blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinkVisible(prev => !prev);
    }, 500);
    return () => clearInterval(blinkInterval);
  }, []);

  // Foreground resume: recalc + check expired timers + force alarm if needed
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        const now = Date.now();

        setTimers(prevTimers => {
          const updated = { ...prevTimers };
          let anyChanged = false;

          Object.keys(updated).forEach(key => {
            const t = updated[key];
            if (t.running && t.startTimestamp) {
              const elapsed = Math.floor((now - t.startTimestamp) / 1000);
              if (elapsed >= t.total) {
                // Expired while backgrounded → activate alarm
                notifee.cancelNotification(`timer-${key}`);
                if (beepSoundRef.current) {
                  beepSoundRef.current.setNumberOfLoops(-1);
                  beepSoundRef.current.play(success => {
                    if (!success) console.log('Sound playback failed');
                  });
                }
                updated[key] = {
                  ...t,
                  running: false,
                  startTimestamp: null,
                  pausedRemaining: 0,
                  alarm: true,
                };
                anyChanged = true;
              }
            }
          });

          return anyChanged ? updated : { ...prevTimers };
        });
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  const playBeep = () => {
    if (beepSoundRef.current) {
      beepSoundRef.current.setNumberOfLoops(-1);
      beepSoundRef.current.play(success => {
        if (!success) console.log('Sound playback failed');
      });
    }
  };

  const stopAlarmLogic = timerId => {
    const otherAlarms = Object.keys(timers).some(
      k => k !== timerId.toString() && timers[k].alarm,
    );

    if (!otherAlarms) {
      if (beepSoundRef.current) beepSoundRef.current.stop();
      notifee.cancelAllNotifications();
    }

    setTimers(prev => ({
      ...prev,
      [timerId]: { ...prev[timerId], alarm: false },
    }));
  };

  const toggleRunning = () => {
    const current = timers[selected];

    if (current.alarm) {
      stopAlarmLogic(selected);
      return;
    }

    const willRun = !current.running;

    if (willRun) {
      const now = Date.now();
      const remaining = current.pausedRemaining || current.total;

      setTimers(prev => ({
        ...prev,
        [selected]: {
          ...prev[selected],
          running: true,
          startTimestamp: now,
          pausedRemaining: 0,
        },
      }));

      if (remaining > 0) {
        scheduleNotification(remaining, selected);
      }
    } else {
      const elapsed = current.startTimestamp
        ? Math.floor((Date.now() - current.startTimestamp) / 1000)
        : 0;
      const remaining = Math.max(0, current.total - elapsed);

      notifee.cancelNotification(`timer-${selected}`);

      setTimers(prev => ({
        ...prev,
        [selected]: {
          ...prev[selected],
          running: false,
          pausedRemaining: remaining,
          startTimestamp: null,
        },
      }));
    }
  };

  const clearTimer = () => {
    const current = timers[selected];
    if (current.alarm) {
      stopAlarmLogic(selected);
    }
    notifee.cancelNotification(`timer-${selected}`);

    setTimers(prev => ({
      ...prev,
      [selected]: { ...initialTimer },
    }));
  };

  const scheduleNotification = async (seconds, timerId) => {
    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + seconds * 1000,
      alarmManager: {
        allowWhileIdle: true, // Helps on Samsung / Doze mode
      },
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
      updated.pausedRemaining = updated.total;

      return { ...prev, [selected]: updated };
    });
  };

  // Selected timer's current display values
  const current = timers[selected];
  let displayTotal = current.total;
  let displayH = current.h;
  let displayM = current.m;
  let displayS = current.s;

  if (current.running && current.startTimestamp) {
    const elapsed = Math.floor((Date.now() - current.startTimestamp) / 1000);
    displayTotal = Math.max(0, current.total - elapsed);

    displayH = Math.floor(displayTotal / 3600);
    displayM = Math.floor((displayTotal % 3600) / 60);
    displayS = displayTotal % 60;

    if (displayTotal <= 0 && !current.alarm) {
      notifee.cancelNotification(`timer-${selected}`);
      playBeep();
      setTimers(prev => ({
        ...prev,
        [selected]: {
          ...prev[selected],
          running: false,
          startTimestamp: null,
          pausedRemaining: 0,
          alarm: true,
        },
      }));
    }
  } else if (!current.running && current.pausedRemaining > 0) {
    displayTotal = current.pausedRemaining;
    displayH = Math.floor(displayTotal / 3600);
    displayM = Math.floor((displayTotal % 3600) / 60);
    displayS = displayTotal % 60;
  }

  const renderTime = () => {
    const hh = String(displayH).padStart(2, '0');
    const mm = String(displayM).padStart(2, '0');
    const ss = String(displayS).padStart(2, '0');

    const showRed = current.alarm && isBlinkVisible;
    const textColor = showRed ? '#FF0000' : '#00FF41';

    if (displayH > 0 || current.alarm) {
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
          const t = timers[n];
          const isAlarming = t.alarm;
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
              {t.running && !t.alarm && (
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
