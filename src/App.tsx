import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  History,
  Home,
  Settings,
  Trophy,
} from 'lucide-react'

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
type Goal = 'bulk' | 'cut' | 'strength' | 'maintain'
type Experience = 'beginner' | 'intermediate' | 'advanced'
type TemplateType = 'default' | 'ppl' | 'arnold' | 'upper-lower' | 'full-body' | 'custom'
type Page = 'today' | 'workout' | 'history' | 'dashboard' | 'settings' | 'templates'

type ExerciseTemplate = {
  id: string
  name: string
  muscleGroup: string
  targetSets: number
  repMin: number
  repMax: number
  defaultRestSec: number
  notes?: string
  sortOrder: number
}

type CardioTemplate = {
  id: string
  type: string
  targetMinutes: number
  notes?: string
}

type TemplateDay = {
  label: string
  muscleGroups: string[]
  exercises?: ExerciseTemplate[]
  cardio?: CardioTemplate[]
}

type WorkoutTemplate = {
  id: string
  name: string
  type: TemplateType
  days: Record<DayKey, TemplateDay>
}

type UserSettings = {
  goal: Goal
  experience: Experience
  defaultRestSec: number
  soundEnabled: boolean
  vibrationEnabled: boolean
  hardcoreMode: boolean
  activeTemplateId: string
  onboardingComplete: boolean
}

type SetEntry = {
  id: string
  exerciseId: string
  setNumber: number
  targetReps: string
  actualReps: number
  targetWeight: number
  actualWeight: number
  completedAt: string
  isWarmup: boolean
  note?: string
}

type ExerciseSession = {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  targetSets: number
  repMin: number
  repMax: number
  suggestedWeight: number
  notes?: string
  setEntries: SetEntry[]
  completed: boolean
  skipped?: boolean
  status?: 'improved' | 'matched' | 'regressed'
}

type WorkoutSession = {
  id: string
  dayKey: DayKey
  startedAt: string
  endedAt?: string
  templateId: string
  exerciseSessions: ExerciseSession[]
  totalRestSeconds: number
  completed: boolean
}

type CardioSession = {
  id: string
  dayKey: DayKey
  type: string
  targetMinutes: number
  actualMinutes: number
  calories?: number
  notes?: string
  startedAt?: string
  endedAt?: string
  completed: boolean
}

type PersonalRecord = {
  exerciseId: string
  heaviestWeight: number
  bestRepsAtWeight: Record<string, number>
  bestSessionVolume: number
}

type WeeklyProgress = Record<string, { completedDays: DayKey[] }>

type AppState = {
  schemaVersion: number
  settings: UserSettings
  templates: WorkoutTemplate[]
  workoutHistory: WorkoutSession[]
  cardioHistory: CardioSession[]
  personalRecords: Record<string, PersonalRecord>
  activeWorkout: WorkoutSession | null
  activeCardio: CardioSession | null
  weeklyProgress: WeeklyProgress
  timer: {
    isRunning: boolean
    startedAt: string | null
    endsAt: string | null
    durationSec: number
    pausedRemainingSec: number | null
    exerciseName: string | null
    nextSetNumber: number | null
    alarmActive: boolean
    minimized: boolean
  }
}

const STORAGE_KEY = 'discipline-mvp-v1'
const SCHEMA_VERSION = 1

const dayOrder: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const dayLabels: Record<DayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const uid = () => Math.random().toString(36).slice(2, 10)

function getTodayKey(): DayKey {
  const jsDay = new Date().getDay()
  const map: Record<number, DayKey> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  }
  return map[jsDay]
}

function startOfWeekKey(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function formatMinSec(totalSec: number) {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function createDefaultTemplate(): WorkoutTemplate {
  const make = (name: string, muscleGroup: string, order: number, sets = 3, repMin = 8, repMax = 12, rest = 90): ExerciseTemplate => ({
    id: uid(),
    name,
    muscleGroup,
    targetSets: sets,
    repMin,
    repMax,
    defaultRestSec: rest,
    sortOrder: order,
  })

  return {
    id: 'tpl-default',
    name: 'Default Split',
    type: 'default',
    days: {
      monday: {
        label: 'Chest + Triceps',
        muscleGroups: ['Chest', 'Triceps'],
        exercises: [
          make('Bench Press', 'Chest', 1),
          make('Incline Dumbbell Press', 'Chest', 2),
          make('Chest Fly', 'Chest', 3),
          make('Tricep Pushdown', 'Triceps', 4),
          make('Overhead Tricep Extension', 'Triceps', 5),
        ],
      },
      tuesday: {
        label: 'Back + Biceps',
        muscleGroups: ['Back', 'Biceps'],
        exercises: [
          make('Lat Pulldown', 'Back', 1),
          make('Barbell Row', 'Back', 2),
          make('Seated Cable Row', 'Back', 3),
          make('Dumbbell Curl', 'Biceps', 4),
          make('Hammer Curl', 'Biceps', 5),
        ],
      },
      wednesday: {
        label: 'Legs + Shoulders + Abs',
        muscleGroups: ['Legs', 'Shoulders', 'Abs'],
        exercises: [
          make('Squat', 'Legs', 1, 4, 6, 10, 120),
          make('Leg Press', 'Legs', 2),
          make('Hamstring Curl', 'Legs', 3),
          make('Shoulder Press', 'Shoulders', 4),
          make('Lateral Raise', 'Shoulders', 5, 3, 12, 15, 60),
          make('Abs Crunches', 'Abs', 6, 3, 15, 20, 45),
        ],
      },
      thursday: { label: 'Chest + Triceps', muscleGroups: ['Chest', 'Triceps'], exercises: [] },
      friday: { label: 'Back + Biceps', muscleGroups: ['Back', 'Biceps'], exercises: [] },
      saturday: { label: 'Legs + Shoulders + Abs', muscleGroups: ['Legs', 'Shoulders', 'Abs'], exercises: [] },
      sunday: {
        label: 'Cardio',
        muscleGroups: ['Cardio'],
        cardio: [
          { id: uid(), type: 'Running', targetMinutes: 20 },
          { id: uid(), type: 'Incline Walk', targetMinutes: 25 },
          { id: uid(), type: 'Cycling', targetMinutes: 30 },
          { id: uid(), type: 'Stairmaster', targetMinutes: 15 },
        ],
      },
    },
  }
}

function cloneDayExercises(exercises?: ExerciseTemplate[]) {
  return (exercises || []).map((e) => ({ ...e, id: uid() }))
}

function seedTemplateVariants(): WorkoutTemplate[] {
  const base = createDefaultTemplate()
  base.days.thursday.exercises = cloneDayExercises(base.days.monday.exercises)
  base.days.friday.exercises = cloneDayExercises(base.days.tuesday.exercises)
  base.days.saturday.exercises = cloneDayExercises(base.days.wednesday.exercises)

  const ppl: WorkoutTemplate = {
    ...base,
    id: 'tpl-ppl',
    name: 'Push Pull Legs',
    type: 'ppl',
    days: {
      ...base.days,
      monday: { ...base.days.monday, label: 'Push', muscleGroups: ['Chest', 'Shoulders', 'Triceps'] },
      tuesday: { ...base.days.tuesday, label: 'Pull', muscleGroups: ['Back', 'Biceps'] },
      wednesday: { ...base.days.wednesday, label: 'Legs', muscleGroups: ['Legs', 'Abs'] },
      thursday: { ...base.days.monday, label: 'Push', exercises: cloneDayExercises(base.days.monday.exercises) },
      friday: { ...base.days.tuesday, label: 'Pull', exercises: cloneDayExercises(base.days.tuesday.exercises) },
      saturday: { ...base.days.wednesday, label: 'Legs', exercises: cloneDayExercises(base.days.wednesday.exercises) },
    },
  }

  const upperLower: WorkoutTemplate = {
    ...base,
    id: 'tpl-upper-lower',
    name: 'Upper Lower',
    type: 'upper-lower',
    days: {
      ...base.days,
      monday: { ...base.days.monday, label: 'Upper', muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms'] },
      tuesday: { ...base.days.wednesday, label: 'Lower', muscleGroups: ['Legs', 'Abs'], exercises: cloneDayExercises(base.days.wednesday.exercises) },
      wednesday: { label: 'Recovery Cardio', muscleGroups: ['Cardio'], cardio: [{ id: uid(), type: 'Incline Walk', targetMinutes: 20 }] },
      thursday: { ...base.days.monday, label: 'Upper', exercises: cloneDayExercises(base.days.monday.exercises) },
      friday: { ...base.days.wednesday, label: 'Lower', exercises: cloneDayExercises(base.days.wednesday.exercises) },
      saturday: { label: 'Recovery Cardio', muscleGroups: ['Cardio'], cardio: [{ id: uid(), type: 'Cycling', targetMinutes: 25 }] },
      sunday: { ...base.days.sunday },
    },
  }

  return [base, ppl, upperLower]
}

function createInitialState(): AppState {
  const templates = seedTemplateVariants()
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      goal: 'bulk',
      experience: 'intermediate',
      defaultRestSec: 90,
      soundEnabled: true,
      vibrationEnabled: true,
      hardcoreMode: false,
      activeTemplateId: templates[0].id,
      onboardingComplete: false,
    },
    templates,
    workoutHistory: [],
    cardioHistory: [],
    personalRecords: {},
    activeWorkout: null,
    activeCardio: null,
    weeklyProgress: {},
    timer: {
      isRunning: false,
      startedAt: null,
      endsAt: null,
      durationSec: 0,
      pausedRemainingSec: null,
      exerciseName: null,
      nextSetNumber: null,
      alarmActive: false,
      minimized: false,
    },
  }
}

function safeLoad(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createInitialState()
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return createInitialState()
    return { ...createInitialState(), ...parsed }
  } catch {
    return createInitialState()
  }
}

function volumeOfExerciseSession(session: ExerciseSession) {
  return session.setEntries.filter((s) => !s.isWarmup).reduce((sum, s) => sum + s.actualWeight * s.actualReps, 0)
}

function compareExercisePerformance(current: ExerciseSession, previous?: ExerciseSession): 'improved' | 'matched' | 'regressed' {
  if (!previous) return 'improved'
  const currVol = volumeOfExerciseSession(current)
  const prevVol = volumeOfExerciseSession(previous)
  if (currVol > prevVol) return 'improved'
  if (currVol === prevVol) return 'matched'
  return 'regressed'
}

function suggestedWeight(previous?: ExerciseSession) {
  if (!previous || previous.setEntries.length === 0) return 20
  const workSets = previous.setEntries.filter((s) => !s.isWarmup)
  if (workSets.length === 0) return 20
  const avg = Math.round(workSets.reduce((sum, s) => sum + s.actualWeight, 0) / workSets.length)
  const allTop = workSets.every((s) => s.actualReps >= previous.repMax)
  return allTop ? avg + 2.5 : avg
}

function getActiveTemplate(state: AppState) {
  return state.templates.find((t) => t.id === state.settings.activeTemplateId) || state.templates[0]
}

function getPreviousExerciseSession(history: WorkoutSession[], exerciseName: string): ExerciseSession | undefined {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const found = history[i].exerciseSessions.find((e) => e.exerciseName === exerciseName)
    if (found) return found
  }
  return undefined
}

function createWorkoutSession(state: AppState, dayKey: DayKey): WorkoutSession {
  const template = getActiveTemplate(state)
  const day = template.days[dayKey]
  const exerciseSessions = (day.exercises || []).map((exercise) => {
    const prev = getPreviousExerciseSession(state.workoutHistory, exercise.name)
    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      targetSets: exercise.targetSets,
      repMin: exercise.repMin,
      repMax: exercise.repMax,
      suggestedWeight: suggestedWeight(prev),
      notes: exercise.notes,
      setEntries: [],
      completed: false,
    } satisfies ExerciseSession
  })
  return {
    id: uid(),
    dayKey,
    startedAt: new Date().toISOString(),
    templateId: template.id,
    exerciseSessions,
    totalRestSeconds: 0,
    completed: false,
  }
}

function getWeekProgress(state: AppState) {
  const key = startOfWeekKey()
  const progress = state.weeklyProgress[key] || { completedDays: [] }
  return { key, progress }
}

function computeStreak(state: AppState) {
  const completedDates = new Set<string>()
  state.workoutHistory.filter((w) => w.completed).forEach((w) => completedDates.add(w.startedAt.slice(0, 10)))
  state.cardioHistory.filter((c) => c.completed && c.startedAt).forEach((c) => completedDates.add((c.startedAt || '').slice(0, 10)))
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 90; i += 1) {
    const key = cursor.toISOString().slice(0, 10)
    if (completedDates.has(key)) streak += 1
    else break
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function totalSetsCompleted(state: AppState) {
  return state.workoutHistory.reduce((sum, w) => sum + w.exerciseSessions.reduce((inner, e) => inner + e.setEntries.filter((s) => !s.isWarmup).length, 0), 0)
}

function weeklyCompliance(state: AppState) {
  const { progress } = getWeekProgress(state)
  return Math.round((progress.completedDays.length / 7) * 100)
}

function useAlarm(enabled: boolean) {
  const intervalRef = useRef<number | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  const buzz = () => {
    if (!enabled) return
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const ctx = audioRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 880
      gain.gain.value = 0.05
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      setTimeout(() => osc.stop(), 250)
    } catch {
      // ignore browser audio restrictions
    }
  }

  const start = (withVibration: boolean) => {
    stop()
    buzz()
    if (withVibration && navigator.vibrate) navigator.vibrate([300, 150, 300])
    intervalRef.current = window.setInterval(() => {
      buzz()
      if (withVibration && navigator.vibrate) navigator.vibrate([300, 150, 300])
    }, 1200)
  }

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (navigator.vibrate) navigator.vibrate(0)
  }

  useEffect(() => stop, [])
  return { start, stop }
}

function StatCard({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="card">
      <div className="stat-label">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function SegmentedDays({ selected, onSelect }: { selected: DayKey; onSelect: (day: DayKey) => void }) {
  return (
    <div className="segmented">
      {dayOrder.map((day) => (
        <button key={day} onClick={() => onSelect(day)} className={selected === day ? 'active' : ''}>
          {dayLabels[day].slice(0, 3)}
        </button>
      ))}
    </div>
  )
}

function ExerciseCard({ exercise, previous, onOpen }: { exercise: ExerciseSession; previous?: ExerciseSession; onOpen: () => void }) {
  const done = exercise.setEntries.filter((s) => !s.isWarmup).length
  return (
    <button onClick={onOpen} className="exercise-card">
      <div className="exercise-top">
        <div>
          <div className="exercise-name">{exercise.exerciseName}</div>
          <div className="muted">{exercise.targetSets} sets • {exercise.repMin}-{exercise.repMax} reps</div>
          <div className="subtle" style={{ marginTop: 8 }}>
            Last session: {previous ? `${previous.setEntries.filter((s) => !s.isWarmup).length}/${previous.targetSets} sets` : 'No history yet'}
          </div>
        </div>
        <div className="pill">{done}/{exercise.targetSets}</div>
      </div>
      {exercise.completed && (
        <div className="done-pill">
          <CheckCircle2 size={16} /> Finished
        </div>
      )}
    </button>
  )
}

function Stepper({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (next: number) => void; step?: number }) {
  return (
    <div className="stepper">
      <div className="stepper-label">{label}</div>
      <div className="stepper-row">
        <button onClick={() => onChange(Math.max(0, value - step))}>-</button>
        <div className="stepper-value">{value}</div>
        <button onClick={() => onChange(value + step)}>+</button>
      </div>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>(() => safeLoad())
  const [page, setPage] = useState<Page>('today')
  const [selectedDay, setSelectedDay] = useState<DayKey>(getTodayKey())
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0)
  const [reps, setReps] = useState(10)
  const [weight, setWeight] = useState(20)
  const [cardioElapsed, setCardioElapsed] = useState(0)

  const { start: startAlarm, stop: stopAlarm } = useAlarm(state.settings.soundEnabled)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const template = useMemo(() => getActiveTemplate(state), [state])
  const dayTemplate = template.days[selectedDay]
  const weekInfo = getWeekProgress(state)
  const streak = computeStreak(state)
  const compliance = weeklyCompliance(state)

  useEffect(() => {
    if (!state.timer.isRunning || !state.timer.endsAt) return undefined
    const id = window.setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((new Date(state.timer.endsAt || 0).getTime() - now) / 1000))
      if (remaining <= 0) {
        setState((prev) => {
          if (prev.timer.alarmActive) return prev
          return {
            ...prev,
            timer: {
              ...prev.timer,
              isRunning: false,
              alarmActive: true,
            },
          }
        })
      }
    }, 250)
    return () => clearInterval(id)
  }, [state.timer.isRunning, state.timer.endsAt, state.timer.alarmActive])

  useEffect(() => {
    if (state.timer.alarmActive) startAlarm(state.settings.vibrationEnabled)
    else stopAlarm()
  }, [state.timer.alarmActive, state.settings.vibrationEnabled, startAlarm, stopAlarm])

  useEffect(() => {
    let id: number | null = null
    if (state.activeCardio?.startedAt && !state.activeCardio.completed) {
      id = window.setInterval(() => {
        setCardioElapsed(Math.floor((Date.now() - new Date(state.activeCardio?.startedAt || 0).getTime()) / 1000))
      }, 1000)
    }
    return () => {
      if (id) clearInterval(id)
    }
  }, [state.activeCardio?.startedAt, state.activeCardio?.completed])

  const currentWorkout = state.activeWorkout
  const currentExercise = currentWorkout?.exerciseSessions[activeExerciseIndex]
  const prevForCurrent = currentExercise ? getPreviousExerciseSession(state.workoutHistory, currentExercise.exerciseName) : undefined
  const remainingTimerSec = state.timer.isRunning && state.timer.endsAt
    ? Math.max(0, Math.ceil((new Date(state.timer.endsAt).getTime() - Date.now()) / 1000))
    : state.timer.pausedRemainingSec || 0

  useEffect(() => {
    if (currentExercise) {
      setWeight(currentExercise.suggestedWeight || 20)
      setReps(currentExercise.repMin)
    }
  }, [activeExerciseIndex, currentExercise?.exerciseId])

  const startToday = () => {
    if (selectedDay === 'sunday') {
      const first = dayTemplate.cardio?.[0]
      if (!first) return
      setState((prev) => ({
        ...prev,
        activeCardio: {
          id: uid(),
          dayKey: 'sunday',
          type: first.type,
          targetMinutes: first.targetMinutes,
          actualMinutes: 0,
          startedAt: new Date().toISOString(),
          completed: false,
        },
      }))
      setPage('workout')
      return
    }

    const workout = createWorkoutSession(state, selectedDay)
    setState((prev) => ({ ...prev, activeWorkout: workout }))
    setActiveExerciseIndex(0)
    setPage('workout')
  }

  const completeSet = () => {
    if (!currentWorkout || !currentExercise) return
    const nextSetNumber = currentExercise.setEntries.filter((s) => !s.isWarmup).length + 1
    const entry: SetEntry = {
      id: uid(),
      exerciseId: currentExercise.exerciseId,
      setNumber: nextSetNumber,
      targetReps: `${currentExercise.repMin}-${currentExercise.repMax}`,
      actualReps: reps,
      targetWeight: currentExercise.suggestedWeight,
      actualWeight: weight,
      completedAt: new Date().toISOString(),
      isWarmup: false,
    }

    const restSec = getActiveTemplate(state).days[currentWorkout.dayKey].exercises?.find((e) => e.name === currentExercise.exerciseName)?.defaultRestSec || state.settings.defaultRestSec

    setState((prev) => {
      if (!prev.activeWorkout) return prev
      const updatedExercises = prev.activeWorkout.exerciseSessions.map((exercise, idx) => {
        if (idx !== activeExerciseIndex) return exercise
        const nextEntries = [...exercise.setEntries, entry]
        const completed = nextEntries.filter((s) => !s.isWarmup).length >= exercise.targetSets
        return { ...exercise, setEntries: nextEntries, completed }
      })
      return {
        ...prev,
        activeWorkout: {
          ...prev.activeWorkout,
          exerciseSessions: updatedExercises,
          totalRestSeconds: prev.activeWorkout.totalRestSeconds + (updatedExercises[activeExerciseIndex].completed ? 0 : restSec),
        },
        timer: updatedExercises[activeExerciseIndex].completed
          ? {
              ...prev.timer,
              isRunning: false,
              startedAt: null,
              endsAt: null,
              durationSec: 0,
              pausedRemainingSec: null,
              exerciseName: null,
              nextSetNumber: null,
              alarmActive: false,
            }
          : {
              ...prev.timer,
              isRunning: true,
              startedAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + restSec * 1000).toISOString(),
              durationSec: restSec,
              pausedRemainingSec: null,
              exerciseName: currentExercise.exerciseName,
              nextSetNumber: nextSetNumber + 1,
              alarmActive: false,
              minimized: false,
            },
      }
    })

    const updatedDone = nextSetNumber >= currentExercise.targetSets
    if (updatedDone && currentWorkout.exerciseSessions[activeExerciseIndex + 1]) {
      setTimeout(() => setActiveExerciseIndex((i) => i + 1), 250)
    }
  }

  const finishWorkout = () => {
    if (!state.activeWorkout) return
    const finalized = {
      ...state.activeWorkout,
      endedAt: new Date().toISOString(),
      completed: true,
      exerciseSessions: state.activeWorkout.exerciseSessions.map((exercise) => ({
        ...exercise,
        status: compareExercisePerformance(exercise, getPreviousExerciseSession(state.workoutHistory, exercise.exerciseName)),
      })),
    }

    const prs = { ...state.personalRecords }
    finalized.exerciseSessions.forEach((exercise) => {
      const volume = volumeOfExerciseSession(exercise)
      const maxWeight = Math.max(0, ...exercise.setEntries.map((s) => s.actualWeight))
      const prev = prs[exercise.exerciseName] || { exerciseId: exercise.exerciseName, heaviestWeight: 0, bestRepsAtWeight: {}, bestSessionVolume: 0 }
      exercise.setEntries.forEach((set) => {
        const key = String(set.actualWeight)
        prev.bestRepsAtWeight[key] = Math.max(prev.bestRepsAtWeight[key] || 0, set.actualReps)
      })
      prs[exercise.exerciseName] = {
        exerciseId: exercise.exerciseName,
        heaviestWeight: Math.max(prev.heaviestWeight, maxWeight),
        bestRepsAtWeight: prev.bestRepsAtWeight,
        bestSessionVolume: Math.max(prev.bestSessionVolume, volume),
      }
    })

    setState((prev) => {
      const completedDays = new Set([...(prev.weeklyProgress[weekInfo.key]?.completedDays || []), finalized.dayKey])
      return {
        ...prev,
        personalRecords: prs,
        workoutHistory: [...prev.workoutHistory, finalized],
        activeWorkout: null,
        timer: {
          ...prev.timer,
          isRunning: false,
          startedAt: null,
          endsAt: null,
          durationSec: 0,
          pausedRemainingSec: null,
          exerciseName: null,
          nextSetNumber: null,
          alarmActive: false,
        },
        weeklyProgress: {
          ...prev.weeklyProgress,
          [weekInfo.key]: { completedDays: Array.from(completedDays) },
        },
      }
    })
    setPage('history')
  }

  const finishCardio = () => {
    if (!state.activeCardio) return
    const done: CardioSession = {
      ...state.activeCardio,
      actualMinutes: Math.round(cardioElapsed / 60),
      endedAt: new Date().toISOString(),
      completed: true,
    }
    setState((prev) => {
      const completedDays = new Set([...(prev.weeklyProgress[weekInfo.key]?.completedDays || []), 'sunday' as DayKey])
      return {
        ...prev,
        cardioHistory: [...prev.cardioHistory, done],
        activeCardio: null,
        weeklyProgress: {
          ...prev.weeklyProgress,
          [weekInfo.key]: { completedDays: Array.from(completedDays) },
        },
      }
    })
    setPage('history')
  }

  const stopAlarmAction = () => {
    if (state.settings.hardcoreMode) return
    setState((prev) => ({ ...prev, timer: { ...prev.timer, alarmActive: false } }))
  }

  const adjustTimer = (delta: number) => {
    setState((prev) => {
      if (prev.timer.isRunning && prev.timer.endsAt) {
        const nextEnd = new Date(new Date(prev.timer.endsAt).getTime() + delta * 1000).toISOString()
        return { ...prev, timer: { ...prev.timer, endsAt: nextEnd, durationSec: prev.timer.durationSec + delta } }
      }
      return prev
    })
  }

  const pauseResumeTimer = () => {
    setState((prev) => {
      if (!prev.timer.isRunning && prev.timer.pausedRemainingSec != null) {
        return {
          ...prev,
          timer: {
            ...prev.timer,
            isRunning: true,
            startedAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + prev.timer.pausedRemainingSec * 1000).toISOString(),
            pausedRemainingSec: null,
          },
        }
      }
      if (prev.timer.isRunning && prev.timer.endsAt) {
        const remaining = Math.max(0, Math.ceil((new Date(prev.timer.endsAt).getTime() - Date.now()) / 1000))
        return {
          ...prev,
          timer: {
            ...prev.timer,
            isRunning: false,
            endsAt: null,
            pausedRemainingSec: remaining,
          },
        }
      }
      return prev
    })
  }

  const resetAll = () => {
    const next = createInitialState()
    setState(next)
    setPage('today')
    setSelectedDay(getTodayKey())
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'discipline-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const lastWorkout = state.workoutHistory[state.workoutHistory.length - 1]

  return (
    <div className="app-shell">
      <div className="container">
        <header className="header">
          <div>
            <div className="eyebrow">Discipline</div>
            <div className="title">{page === 'workout' ? 'Execute' : 'Train'}</div>
          </div>
          <div className="day-badge">{dayLabels[selectedDay]}</div>
        </header>

        {!state.settings.onboardingComplete ? (
          <div className="stack">
            <div className="card-dark">
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>Set your standard.</div>
              <div className="muted" style={{ marginTop: 8 }}>Get the app ready in under a minute. Then train.</div>
            </div>

            <div className="grid-2">
              <label className="card">
                <div className="stepper-label">Goal</div>
                <select className="select" value={state.settings.goal} onChange={(e) => setState((prev) => ({ ...prev, settings: { ...prev.settings, goal: e.target.value as Goal } }))}>
                  <option value="bulk">Bulk</option>
                  <option value="cut">Cut</option>
                  <option value="strength">Strength</option>
                  <option value="maintain">Maintain</option>
                </select>
              </label>

              <label className="card">
                <div className="stepper-label">Experience</div>
                <select className="select" value={state.settings.experience} onChange={(e) => setState((prev) => ({ ...prev, settings: { ...prev.settings, experience: e.target.value as Experience } }))}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>

            <label className="card">
              <div className="stepper-label">Template</div>
              <select className="select" value={state.settings.activeTemplateId} onChange={(e) => setState((prev) => ({ ...prev, settings: { ...prev.settings, activeTemplateId: e.target.value } }))}>
                {state.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>

            <Stepper label="Default Rest (sec)" value={state.settings.defaultRestSec} onChange={(next) => setState((prev) => ({ ...prev, settings: { ...prev.settings, defaultRestSec: next } }))} step={15} />

            <div className="grid-3">
            {[
  ['Sound', state.settings.soundEnabled, 'soundEnabled'],
  ['Vibration', state.settings.vibrationEnabled, 'vibrationEnabled'],
  ['Hardcore', state.settings.hardcoreMode, 'hardcoreMode'],
].map(([label, value, key]) => (
  <button
    key={String(key)}
    onClick={() =>
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [key as 'soundEnabled' | 'vibrationEnabled' | 'hardcoreMode']: !Boolean(value),
        },
      }))
    }
    className={value ? 'btn-primary' : 'btn-secondary'}
  >
    {String(label)}
  </button>
))}
            </div>

            <button onClick={() => setState((prev) => ({ ...prev, settings: { ...prev.settings, onboardingComplete: true } }))} className="btn-primary">
              Start Discipline
            </button>
          </div>
        ) : (
          <>
            {page === 'today' && (
              <div className="stack">
                <div className="grid-2">
                  <StatCard label="Streak" value={`${streak} days`} icon={Flame} />
                  <StatCard label="Compliance" value={`${compliance}%`} icon={CalendarDays} />
                </div>

                <div className="card-dark">
                  <div className="eyebrow">Today</div>
                  <div style={{ marginTop: 6, fontSize: 30, fontWeight: 800, color: '#fff' }}>{dayTemplate.label}</div>
                  <div className="muted" style={{ marginTop: 8 }}>{dayTemplate.muscleGroups.join(' • ')}</div>
                  <div style={{ marginTop: 20 }}>
                    <SegmentedDays selected={selectedDay} onSelect={setSelectedDay} />
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <button onClick={startToday} className="btn-primary">Start Workout</button>
                  </div>
                </div>

                {selectedDay === 'sunday' ? (
                  <div className="stack">
                    {(dayTemplate.cardio || []).map((c) => (
                      <div key={c.id} className="card">
                        <div className="exercise-name">{c.type}</div>
                        <div className="muted">Target {c.targetMinutes} min</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="stack">
                    {(state.activeWorkout?.dayKey === selectedDay ? state.activeWorkout.exerciseSessions : createWorkoutSession(state, selectedDay).exerciseSessions).map((exercise) => (
                      <ExerciseCard
                        key={exercise.exerciseId}
                        exercise={exercise}
                        previous={getPreviousExerciseSession(state.workoutHistory, exercise.exerciseName)}
                        onOpen={() => {
                          if (!state.activeWorkout || state.activeWorkout.dayKey !== selectedDay) {
                            setState((prev) => ({ ...prev, activeWorkout: createWorkoutSession(prev, selectedDay) }))
                          }
                          const src = state.activeWorkout?.dayKey === selectedDay ? state.activeWorkout.exerciseSessions : createWorkoutSession(state, selectedDay).exerciseSessions
                          const idx = src.findIndex((e) => e.exerciseName === exercise.exerciseName)
                          setActiveExerciseIndex(Math.max(0, idx))
                          setPage('workout')
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {page === 'workout' && state.activeCardio && (
              <div className="stack">
                <div className="card-dark">
                  <div className="eyebrow">Cardio</div>
                  <div style={{ marginTop: 6, fontSize: 40, fontWeight: 900, color: '#fff' }}>{state.activeCardio.type}</div>
                  <div className="muted" style={{ marginTop: 8 }}>Target {state.activeCardio.targetMinutes} min</div>
                  <div className="text-center" style={{ marginTop: 28, fontSize: 64, fontWeight: 900, color: '#fff' }}>{formatMinSec(cardioElapsed)}</div>
                  <div className="grid-2" style={{ marginTop: 24 }}>
                    <button onClick={finishCardio} className="btn-primary">Finish</button>
                    <button onClick={() => { setState((prev) => ({ ...prev, activeCardio: null })); setPage('today') }} className="btn-secondary">Stop</button>
                  </div>
                </div>
              </div>
            )}

            {page === 'workout' && currentWorkout && currentExercise && !state.activeCardio && (
              <div className="stack">
                <div className="row-between">
                  <button className="card" style={{ padding: 12 }} onClick={() => setActiveExerciseIndex((i) => Math.max(0, i - 1))}><ChevronLeft /></button>
                  <div className="text-center">
                    <div className="eyebrow">Active Exercise</div>
                    <div className="workout-counter">{currentExercise.exerciseName}</div>
                    <div className="muted">{currentExercise.muscleGroup}</div>
                  </div>
                  <button className="card" style={{ padding: 12 }} onClick={() => setActiveExerciseIndex((i) => Math.min(currentWorkout.exerciseSessions.length - 1, i + 1))}><ChevronRight /></button>
                </div>

                <div className="grid-2">
                  <StatCard label="Set" value={`${Math.min(currentExercise.setEntries.filter((s) => !s.isWarmup).length + 1, currentExercise.targetSets)}/${currentExercise.targetSets}`} icon={Dumbbell} />
                  <StatCard label="Target" value={`${currentExercise.repMin}-${currentExercise.repMax} reps`} icon={Trophy} />
                </div>

                <div className="card-dark">
                  <div className="eyebrow">Beat Last Session</div>
                  <div className="muted" style={{ marginTop: 10 }}>
                    Previous: {prevForCurrent ? `${prevForCurrent.setEntries.filter((s) => !s.isWarmup).length}/${prevForCurrent.targetSets} sets • ${Math.round(volumeOfExerciseSession(prevForCurrent))} volume` : 'No history yet. Set the first standard.'}
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>Suggested weight: {currentExercise.suggestedWeight} kg</div>
                </div>

                <Stepper label="Reps" value={reps} onChange={setReps} />
                <Stepper label="Weight (kg)" value={weight} onChange={setWeight} step={2.5} />

                <div className="grid-2">
                  <button onClick={completeSet} className="btn-primary">Complete Set</button>
                  <button onClick={() => setState((prev) => {
                    if (!prev.activeWorkout) return prev
                    const exerciseSessions = prev.activeWorkout.exerciseSessions.map((e, idx) => idx === activeExerciseIndex ? { ...e, completed: true, skipped: true } : e)
                    return { ...prev, activeWorkout: { ...prev.activeWorkout, exerciseSessions } }
                  })} className="btn-secondary">Skip Exercise</button>
                </div>

                <div className="card">
                  <div className="row-between" style={{ marginBottom: 12 }}>
                    <div className="eyebrow">Logged Sets</div>
                    <div className="muted">{currentExercise.setEntries.filter((s) => !s.isWarmup).length}/{currentExercise.targetSets}</div>
                  </div>
                  <div className="small-list">
                    {currentExercise.setEntries.length === 0 && <div className="subtle">No sets logged yet.</div>}
                    {currentExercise.setEntries.map((set) => (
                      <div key={set.id} className="small-item">
                        <div className="muted">Set {set.setNumber}</div>
                        <div style={{ fontWeight: 700, color: '#fff' }}>{set.actualReps} reps • {set.actualWeight} kg</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={finishWorkout} className="btn-success">Finish Workout</button>
              </div>
            )}

            {page === 'history' && (
              <div className="stack">
                {lastWorkout && (
                  <div className="card-dark">
                    <div className="eyebrow">Latest Session</div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: '#fff' }}>Session complete.</div>
                    <div className="muted" style={{ marginTop: 12 }}>
                      Duration: {lastWorkout.endedAt ? formatDuration(Math.max(0, Math.floor((new Date(lastWorkout.endedAt).getTime() - new Date(lastWorkout.startedAt).getTime()) / 1000))) : '-'}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Sets: {lastWorkout.exerciseSessions.reduce((sum, e) => sum + e.setEntries.filter((s) => !s.isWarmup).length, 0)}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>Rest: {formatDuration(lastWorkout.totalRestSeconds)}</div>
                  </div>
                )}

                <div className="stack">
                  {state.workoutHistory.slice().reverse().map((workout) => (
                    <div key={workout.id} className="card">
                      <div className="row-between">
                        <div>
                          <div className="exercise-name">{dayLabels[workout.dayKey]}</div>
                          <div className="muted">{new Date(workout.startedAt).toLocaleDateString()}</div>
                        </div>
                        <div className="pill">{workout.exerciseSessions.length} exercises</div>
                      </div>
                    </div>
                  ))}
                  {state.cardioHistory.slice().reverse().map((cardio) => (
                    <div key={cardio.id} className="card">
                      <div className="exercise-name">Cardio • {cardio.type}</div>
                      <div className="muted">{cardio.actualMinutes} min</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {page === 'dashboard' && (
              <div className="stack">
                <div className="grid-2">
                  <StatCard label="Current streak" value={`${streak}`} icon={Flame} />
                  <StatCard label="Total sets" value={totalSetsCompleted(state)} icon={Dumbbell} />
                  <StatCard label="Workouts" value={state.workoutHistory.length + state.cardioHistory.length} icon={History} />
                  <StatCard label="PR count" value={Object.keys(state.personalRecords).length} icon={Trophy} />
                </div>
                <div className="card-dark">
                  <div className="exercise-name">This week</div>
                  <div className="grid-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', marginTop: 14 }}>
                    {dayOrder.map((day) => {
                      const done = weekInfo.progress.completedDays.includes(day)
                      return (
                        <div
                          key={day}
                          style={{
                            borderRadius: 16,
                            padding: '12px 0',
                            textAlign: 'center',
                            fontSize: 12,
                            fontWeight: 800,
                            background: done ? '#fff' : 'rgba(255,255,255,0.05)',
                            color: done ? '#000' : '#71717a',
                          }}
                        >
                          {dayLabels[day].slice(0, 1)}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {page === 'settings' && (
              <div className="stack">
                <Stepper label="Default Rest (sec)" value={state.settings.defaultRestSec} onChange={(next) => setState((prev) => ({ ...prev, settings: { ...prev.settings, defaultRestSec: next } }))} step={15} />
                <label className="card">
                  <div className="stepper-label">Active Template</div>
                  <select className="select" value={state.settings.activeTemplateId} onChange={(e) => setState((prev) => ({ ...prev, settings: { ...prev.settings, activeTemplateId: e.target.value } }))}>
                    {state.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <div className="grid-3">
             {[
  ['Sound', state.settings.soundEnabled, 'soundEnabled'],
  ['Vibration', state.settings.vibrationEnabled, 'vibrationEnabled'],
  ['Hardcore', state.settings.hardcoreMode, 'hardcoreMode'],
].map(([label, value, key]) => (
  <button
    key={String(key)}
    onClick={() =>
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          [key as 'soundEnabled' | 'vibrationEnabled' | 'hardcoreMode']: !Boolean(value),
        },
      }))
    }
    className={value ? 'btn-primary' : 'btn-secondary'}
  >
    {String(label)}
  </button>
))}
                </div>
                <button onClick={exportData} className="btn-secondary">Export JSON Backup</button>
                <button onClick={resetAll} className="btn-danger">Reset All Data</button>
              </div>
            )}

            {page === 'templates' && (
              <div className="stack">
                {state.templates.map((t) => (
                  <div key={t.id} className="card">
                    <div className="row-between">
                      <div>
                        <div className="exercise-name">{t.name}</div>
                        <div className="muted">{t.type}</div>
                      </div>
                      <button
                        onClick={() => setState((prev) => ({ ...prev, settings: { ...prev.settings, activeTemplateId: t.id } }))}
                        className={state.settings.activeTemplateId === t.id ? 'btn-primary' : 'btn-secondary'}
                        style={{ width: 'auto', padding: '12px 16px' }}
                      >
                        {state.settings.activeTemplateId === t.id ? 'Active' : 'Use'}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="card subtle">Template editing and duplication are not finished yet. The execution core is the real build right now.</div>
              </div>
            )}
          </>
        )}
      </div>

      {(state.timer.isRunning || state.timer.alarmActive || state.timer.pausedRemainingSec != null) && page === 'workout' && !state.activeCardio && (
        <div className="timer-overlay">
          <div className={`timer-card ${state.timer.alarmActive ? 'alarm' : ''}`}>
            <div className="eyebrow">Rest Timer</div>
            <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: '#fff' }}>{state.timer.exerciseName} • Set {state.timer.nextSetNumber}</div>
            <div className={`timer-big ${state.timer.alarmActive ? 'alarm' : ''}`}>{formatMinSec(remainingTimerSec)}</div>
            <div className="grid-2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginTop: 16 }}>
              <button onClick={pauseResumeTimer} className="btn-secondary" style={{ padding: '14px 10px' }}>{state.timer.isRunning ? 'Pause' : 'Resume'}</button>
              <button onClick={() => adjustTimer(15)} className="btn-secondary" style={{ padding: '14px 10px' }}>+15</button>
              <button onClick={() => adjustTimer(30)} className="btn-secondary" style={{ padding: '14px 10px' }}>+30</button>
              <button onClick={() => setState((prev) => ({ ...prev, timer: { ...prev.timer, isRunning: false, pausedRemainingSec: null, endsAt: null, alarmActive: false } }))} className="btn-secondary" style={{ padding: '14px 10px' }}>Skip</button>
            </div>
            {!state.settings.hardcoreMode && state.timer.alarmActive && (
              <button onClick={stopAlarmAction} className="btn-primary" style={{ marginTop: 12 }}>Stop Alarm</button>
            )}
            {state.settings.hardcoreMode && state.timer.alarmActive && (
              <div className="notice" style={{ marginTop: 12 }}>Hardcore mode is active. Log the next set or skip the exercise to silence the alarm.</div>
            )}
          </div>
        </div>
      )}

      {state.settings.onboardingComplete && (
        <nav className="bottom-nav">
          {[
            ['today', Home],
            ['dashboard', Trophy],
            ['history', History],
            ['templates', CalendarDays],
            ['settings', Settings],
          ].map(([key, Icon]) => {
            const LucideIcon = Icon as React.ComponentType<{ className?: string }>
            return (
              <button key={String(key)} onClick={() => setPage(key as Page)} className={page === key ? 'active' : ''}>
                <LucideIcon className="h-5 w-5" />
                {String(key)}
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
