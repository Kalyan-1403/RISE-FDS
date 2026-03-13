from app import create_app
from app.extensions import db
from app.models.batch import Batch

app = create_app()

with app.app_context():
    batches = Batch.query.all()
    if batches:
        print(f"Found {len(batches)} batches:")
        for b in batches:
            print(f"  ID: {b.batch_id}")
            print(f"  Active: {b.is_active}")
            print(f"  Faculty count: {len(b.faculty_list)}")
            print(f"  ---")
    else:
        print("NO BATCHES IN DATABASE")