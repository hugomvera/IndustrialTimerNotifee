import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';

export default function App() {
  const initialTimer = { h: 0, m: 0, s: 0, running: false, total: 0 };

  const [timers, setTimers] = useState({
    1: { ...initialTimer },
    2: { ...initialTimer },
    3: { ...initialTimer },
    4: { ...initialTimer },
  });

  const [selected, setSelected] = useState(1); // currently selected timer (1–4)

  // Recalculate total seconds when h/m/s changes
  useEffect(() => {
    setTimers(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        const t = updated[key];
        updated[key] = {
          ...t,
          total: t.h * 3600 + t.m * 60 + t.s,
        };
      });
      return updated;
    });
  }, [
    timers[1].h,
    timers[1].m,
    timers[1].s,
    timers[2].h,
    timers[2].m,
    timers[2].s,
    timers[3].h,
    timers[3].m,
    timers[3].s,
    timers[4].h,
    timers[4].m,
    timers[4].s,
  ]);

  // Countdown logic + alert when time is up
  useEffect(() => {
    let interval = null;

    const activeTimerKey = Object.keys(timers).find(key => timers[key].running);

    if (activeTimerKey) {
      interval = setInterval(() => {
        setTimers(prev => {
          const t = prev[activeTimerKey];

          if (t.total <= 0) {
            // Show alert
            Alert.alert(
              "Time's Up!",
              `Timer T${activeTimerKey} has finished!`,
              [{ text: 'OK', style: 'default' }],
              { cancelable: true },
            );

            // Reset this timer
            return {
              ...prev,
              [activeTimerKey]: { ...initialTimer, running: false },
            };
          }

          const newTotal = t.total - 1;
          const newH = Math.floor(newTotal / 3600);
          const newM = Math.floor((newTotal % 3600) / 60);
          const newS = newTotal % 60;

          return {
            ...prev,
            [activeTimerKey]: {
              ...t,
              h: newH,
              m: newM,
              s: newS,
              total: newTotal,
            },
          };
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [timers]);

  const adjustTime = (unit, delta) => {
    setTimers(prev => {
      const t = prev[selected];
      let newVal = t[unit] + delta;
      if (newVal < 0) newVal = 0;

      return {
        ...prev,
        [selected]: { ...t, [unit]: newVal },
      };
    });
  };

  const toggleRunning = () => {
    setTimers(prev => {
      const updated = { ...prev };
      // Stop all other timers
      Object.keys(updated).forEach(key => {
        if (Number(key) !== selected) {
          updated[key] = { ...updated[key], running: false };
        }
      });
      const current = updated[selected];
      return {
        ...updated,
        [selected]: { ...current, running: !current.running },
      };
    });
  };

  const clearTimer = () => {
    setTimers(prev => ({
      ...prev,
      [selected]: { ...initialTimer },
    }));
  };

  const current = timers[selected];
  const displayH = String(current.h).padStart(2, '0');
  const displayM = String(current.m).padStart(2, '0');
  const displayS = String(current.s).padStart(2, '0');

  return (
    <SafeAreaView style={styles.container}>
      {/* Status */}
      <Text style={styles.status}>
        {current.running ? `TIMER T${selected} ACTIVE` : 'IDLE'}
      </Text>

      {/* Display */}
      <View style={styles.lcd}>
        <Text style={styles.lcdText}>
          {displayH}:{displayM}:{displayS}
        </Text>
      </View>

      {/* Timer selection (T1–T4) */}
      <View style={styles.row}>
        {[1, 2, 3, 4].map(num => (
          <TouchableOpacity
            key={num}
            onPress={() => setSelected(num)}
            style={[styles.btnSmall, selected === num && styles.btnSelected]}
          >
            <Text style={styles.white}>T{num}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Seconds +/- */}
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

      {/* Minutes +/- */}
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

      {/* Hours +/- */}
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

      {/* Clear & Start/Stop */}
      <View style={styles.row}>
        <TouchableOpacity onPress={clearTimer} style={styles.btnClear}>
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
    fontWeight: 'bold',
    fontSize: 18,
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
  lcdText: {
    color: '#00FF41',
    fontSize: 70,
    fontFamily: 'monospace',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#333',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '45%',
    alignItems: 'center',
  },
  btnSmall: {
    backgroundColor: '#444',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    width: '22%',
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
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '40%',
    alignItems: 'center',
  },
  start: {
    height: 70,
    width: '55%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  white: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
