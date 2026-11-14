"""Generates public/guest-card-template.xlsx (column names = the Guest Information Card)."""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

HEAD = ["Date", "Surname", "Other Names", "Gender", "Age", "Status", "Phone No", "Email", "Town",
        "Local Government Area", "Area", "Nearest Bus Stop", "House No", "Street/Estate", "Current Sector",
        "Occupation", "Interests", "Would you consider joining", "Prayer Request", "Needs and Aspirations",
        "How did you get to know about our church"]
SAMPLE = [
    ["2026-11-08", "Okafor", "Chiamaka Grace", "Female", "26-30", "Single", "0803 123 4567", "chiamaka@example.com", "Lekki",
     "Eti-Osa", "Lekki Phase 1", "Lekki Phase 1 Gate", "12", "Admiralty Way", "Career Professional", "Accountant",
     "Family Life, Media", "Yes", "Job promotion", "Grow spiritually and find a church family", "A friend/ Family"],
    ["2026-11-08", "Bello", "Tunde", "Male", "31-35", "Married", "08061234568", "", "Ajah", "Eti-Osa", "Ajah",
     "Ajah Under Bridge", "4", "Thomas Estate", "Business Owner", "Caterer", "Technology", "Maybe", "",
     "Business growth", "Instagram/ Facebook/ Twitter"],
]

def build(path, rows):
    wb = Workbook(); ws = wb.active; ws.title = "Guests"
    ws.append(HEAD)
    for r in rows: ws.append(r)
    navy = PatternFill("solid", fgColor="0B1B3A")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = navy
        c.alignment = Alignment(wrap_text=True, vertical="center")
        c.border = Border(bottom=Side(style="thin", color="CFA145"))
    ws.row_dimensions[1].height = 34
    widths = [12, 16, 20, 10, 11, 18, 16, 26, 14, 18, 16, 20, 9, 20, 20, 20, 24, 14, 28, 34, 30]
    for i, w in enumerate(widths): ws.column_dimensions[chr(65 + i)].width = w
    ws.freeze_panes = "B2"
    def dv(col, opts):
        v = DataValidation(type="list", formula1='"' + ",".join(opts) + '"', allow_blank=True, showErrorMessage=False)
        ws.add_data_validation(v); v.add(f"{col}2:{col}2000")
    dv("D", ["Male", "Female"])
    dv("E", ["15-20", "21-25", "26-30", "31-35", "36-40", "41-45", "46-50", "50 & above"])
    dv("F", ["Married", "Single", "Divorced/Separated/Widowed", "Prefer not to say"])
    dv("O", ["Unemployed", "Self-employed", "Education", "NGO", "Government Worker", "Career Professional", "Business Owner", "Student"])
    dv("R", ["Yes", "No", "Maybe"])
    wb.save(path)

if __name__ == "__main__":
    build(sys.argv[1], SAMPLE if len(sys.argv) < 3 else [])
