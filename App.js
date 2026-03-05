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
  TimestampTrigger,
  TriggerType,
  AndroidImportance,
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
  const beepSoundRef = useRef(null);

  // Initialize Sound for foreground use
  useEffect(() => {
    beepSoundRef.current = new Sound('beep.wav', Sound.MAIN_BUNDLE);
    return () => {
      if (beepSoundRef.current) beepSoundRef.current.release();
    };
  }, []);

  // Create Notifee Channel on mount
  useEffect(() => {
    const createChannel = async () => {
      await notifee.createChannel({
        id: 'timer-channel',
        name: 'Timer Alerts',
        importance: AndroidImportance.HIGH,
        sound: 'beep', // References res/raw/beep.wav (omit .wav)
      });
    };
    createChannel();
  }, []);

  const playBeep = () => {
    if (beepSoundRef.current) {
      beepSoundRef.current.setNumberOfLoops(-1);
      beepSoundRef.current.play();
    }
  };

  const stopBeep = () => {
    if (beepSoundRef.current) beepSoundRef.current.stop();
    notifee.cancelAllNotifications(); // Clear any pending/active notifications
  };

  // Schedule Background Notification
  const scheduleNotification = async (seconds, timerId) => {
    const date = new Date(Date.now() + seconds * 1000);

    const trigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: date.getTime(),
    };

    await notifee.createTriggerNotification(
      {
        id: `timer-${timerId}`,
        title: 'Industrial Timer Finished',
        body: `Timer T${timerId} has reached zero!`,
        android: {
          channelId: 'timer-channel',
          importance: AndroidImportance.HIGH,
          pressAction: { id: 'default' },
          sound: 'beep', // Must match the filename in res/raw
        },
      },
      trigger,
    );
  };

  // Foreground Interval (Same as before)
  useEffect(() => {
    const activeKey = Object.keys(timers).find(k => timers[k].running);
    if (!activeKey) return;

    const interval = setInterval(() => {
      setTimers(prev => {
        const t = prev[activeKey];
        if (t.total <= 1) {
          playBeep();
          clearInterval(interval);
          return { ...prev, [activeKey]: { ...initialTimer, running: false } };
        }
        return {
          ...prev,
          [activeKey]: {
            ...t,
            total: t.total - 1,
            h: Math.floor((t.total - 1) / 3600),
            m: Math.floor(((t.total - 1) % 3600) / 60),
            s: (t.total - 1) % 60,
          },
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timers]);

  const toggleRunning = () => {
    const current = timers[selected];
    const willRun = !current.running;

    stopBeep();

    if (willRun && current.total > 0) {
      scheduleNotification(current.total, selected);
    } else {
      notifee.cancelNotification(`timer-${selected}`);
    }

    setTimers(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        if (k != selected) updated[k].running = false;
      });
      updated[selected].running = willRun;
      return updated;
    });
  };

  const adjustTime = (unit, delta) => {
    setTimers(prev => {
      const t = prev[selected];
      if (t.running) return prev;
      let newVal = Math.max(0, t[unit] + delta);
      const newT = { ...t, [unit]: newVal };
      newT.total = newT.h * 3600 + newT.m * 60 + newT.s;
      return { ...prev, [selected]: newT };
    });
  };

  const current = timers[selected];
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.status}>
        {current.running ? `T${selected} ACTIVE` : 'IDLE'}
      </Text>
      <View style={styles.lcd}>
        <Text style={styles.lcdText}>
          {String(current.h).padStart(2, '0')}:
          {String(current.m).padStart(2, '0')}:
          {String(current.s).padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.row}>
        {[1, 2, 3, 4].map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => {
              stopBeep();
              setSelected(n);
            }}
            style={[styles.btnSmall, selected === n && styles.btnSelected]}
          >
            <Text style={styles.white}>T{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => adjustTime('h', 1)} style={styles.btn}>
          <Text style={styles.white}>Hr +</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => adjustTime('h', -1)}
          style={styles.btn}
        >
          <Text style={styles.white}>Hr -</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => adjustTime('m', 1)} style={styles.btn}>
          <Text style={styles.white}>Min +</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => adjustTime('m', -1)}
          style={styles.btn}
        >
          <Text style={styles.white}>Min -</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => adjustTime('s', 1)} style={styles.btn}>
          <Text style={styles.white}>Sec +</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => adjustTime('s', -1)}
          style={styles.btn}
        >
          <Text style={styles.white}>Sec -</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
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
  status: {
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 18,
    fontWeight: 'bold',
  },
  lcd: {
    backgroundColor: '#111',
    padding: 40,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#333',
    marginBottom: 30,
    alignItems: 'center',
  },
  lcdText: { color: '#00FF41', fontSize: 70, fontFamily: 'monospace' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#333',
    paddingVertical: 14,
    width: '45%',
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSmall: {
    backgroundColor: '#444',
    paddingVertical: 12,
    width: '22%',
    borderRadius: 10,
    alignItems: 'center',
  },
  btnSelected: {
    backgroundColor: '#0066cc',
    borderWidth: 2,
    borderColor: '#3399ff',
  },
  btnClear: {
    backgroundColor: '#555',
    paddingVertical: 18,
    width: '40%',
    borderRadius: 10,
    alignItems: 'center',
  },
  start: {
    height: 70,
    width: '55%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  white: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
});
