"""Structural checks for untrusted extraction output; no clinical verification."""
import json
import math

SCALARS = {'name','active_ingredient','strength','dosage_form','dosage','route','frequency',
 'duration','instructions','instruction','quantity','unit_price','total_price',
 'patient_name','doctor_name','hospital_name','prescription_date',
 'pharmacy_name','bill_number','bill_date','total_amount','raw_ocr_text','message'}
SECTIONS = {'symptoms','diagnosis','non_medicine_treatment','care_instructions','tests',
 'investigations','follow_up','additional_notes','uncertain_information'}


def safe_analysis(result):
    def scalar(value):
        return value is None or isinstance(value,str) or type(value) is int or (type(value) is float and math.isfinite(value))
    if not isinstance(result,dict) or not isinstance(result.get('medicines'),list) or len(result['medicines'])>200:
        return False
    for obj in [result,*result['medicines']]:
        if not isinstance(obj,dict): return False
        for key,value in obj.items():
            if key in SCALARS and not scalar(value): return False
            if key=='uncertain_fields' and (not isinstance(value,list) or not all(isinstance(x,str) for x in value)):return False
    for key in SECTIONS:
        if key in result and (not isinstance(result[key],list) or not all(isinstance(item,(str,dict)) for item in result[key])):return False
    try:return len(json.dumps(result,allow_nan=False))<=200000
    except (TypeError,ValueError):return False
