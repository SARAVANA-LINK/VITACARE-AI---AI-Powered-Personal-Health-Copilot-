import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.all_models import User, UserProfile, WellnessLog
from app.schemas.all_schemas import WaterLogRequest, ActivityLogRequest

router = APIRouter(prefix="/wellness", tags=["Wellness & Nutrition"])

def get_today_str() -> str:
    return datetime.datetime.utcnow().strftime("%Y-%m-%d")

@router.get("/summary")
def get_wellness_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = get_today_str()
    log = db.query(WellnessLog).filter(
        WellnessLog.user_id == current_user.id, WellnessLog.date == today
    ).first()

    if not log:
        log = WellnessLog(
            user_id=current_user.id,
            date=today,
            water_glasses=5,
            water_ml=1250,
            target_water_ml=2500,
            steps=4250,
            target_steps=7000,
            active_minutes=35,
            sleep_hours=7.2,
            nutrition_notes="Balanced high-fiber Mediterranean diet with reduced sodium."
        )
        db.add(log)
        db.commit()
        db.refresh(log)

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    bmi = None
    bmi_category = None
    if profile and profile.height_cm and profile.weight_kg:
        height_m = profile.height_cm / 100.0
        bmi = round(profile.weight_kg / (height_m * height_m), 1)
        if bmi < 18.5: bmi_category = "Underweight"
        elif bmi < 24.9: bmi_category = "Healthy Weight"
        elif bmi < 29.9: bmi_category = "Overweight"
        else: bmi_category = "Obese Range"

    hydration_pct = min(100, int((log.water_ml / (log.target_water_ml or 2500)) * 100))
    activity_pct = min(100, int((log.steps / (log.target_steps or 7000)) * 100))

    return {
        "wellness": {
            "date": log.date,
            "waterGlasses": log.water_glasses,
            "waterMl": log.water_ml,
            "targetWaterMl": log.target_water_ml,
            "steps": log.steps,
            "targetSteps": log.target_steps,
            "activeMinutes": log.active_minutes,
            "sleepHours": log.sleep_hours,
            "nutritionNotes": log.nutrition_notes
        },
        "bmi": bmi,
        "bmiCategory": bmi_category,
        "hydrationPercentage": hydration_pct,
        "activityPercentage": activity_pct
    }

@router.post("/water")
def log_water(req: WaterLogRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = get_today_str()
    log = db.query(WellnessLog).filter(
        WellnessLog.user_id == current_user.id, WellnessLog.date == today
    ).first()

    if not log:
        log = WellnessLog(
            user_id=current_user.id,
            date=today,
            water_glasses=0 if req.reset else (req.deltaGlasses or 1),
            water_ml=0 if req.reset else (req.deltaMl or 250)
        )
        db.add(log)
    else:
        if req.reset:
            log.water_glasses = 0
            log.water_ml = 0
        else:
            log.water_glasses = max(0, log.water_glasses + (req.deltaGlasses or 1))
            log.water_ml = max(0, log.water_ml + (req.deltaMl or 250))

    db.commit()
    db.refresh(log)

    return {
        "success": True,
        "wellness": {
            "waterGlasses": log.water_glasses,
            "waterMl": log.water_ml,
            "targetWaterMl": log.target_water_ml
        },
        "hydrationPercentage": min(100, int((log.water_ml / 2500) * 100))
    }

@router.post("/activity")
def log_activity(req: ActivityLogRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = get_today_str()
    log = db.query(WellnessLog).filter(
        WellnessLog.user_id == current_user.id, WellnessLog.date == today
    ).first()

    if not log:
        log = WellnessLog(user_id=current_user.id, date=today)
        db.add(log)

    if req.steps is not None: log.steps = req.steps
    if req.activeMinutes is not None: log.active_minutes = req.activeMinutes
    if req.sleepHours is not None: log.sleep_hours = req.sleepHours

    db.commit()
    db.refresh(log)

    return {"success": True, "wellness": log}
