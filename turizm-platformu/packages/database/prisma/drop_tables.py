import pg8000.dbapi as pgdb

conn = pgdb.connect(user='postgres', password='1234', host='localhost', port=5432, database='trabzon_turizm')
cur = conn.cursor()
tables = [
    'favorites', 'review_likes', 'reviews', 'destinations', 'destinasyon_turleri', 
    'iller', 'trabzon_destinasyonlar', 'users', 'user_profiles', 'user_tours',
    'tour_destinations', 'popular_routes', 'posts', 'post_likes', 'comments',
    'follows', 'notifications', 'admin_users', 'audit_logs', 
    'email_verification_tokens', 'password_reset_tokens', 'refresh_tokens',
    'weather_cache', 'clicks', 'district', 'province', 'destination_category',
    'destination_translation'
]
for t in tables:
    try:
        cur.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE;')
        print(f'Dropped: {t}')
    except Exception as e:
        print(f'Error dropping {t}: {e}')
conn.commit()
cur.close()
conn.close()
print('Done')