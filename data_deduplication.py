import pandas as pd
import re

df = pd.read_csv('data_raw.csv', encoding='utf-8-sig')


# Step 2: Deduplicate by pattern
def normalize_name(name):
    name = str(name).strip()
    name = re.sub(r'\s*[-–]\s*[Tt]ập\s*\d+', '', name)
    name = re.sub(r'\s*\([Tt]ập\s*\d+\)', '', name)
    name = re.sub(r'\s*[Tt]ập\s*\d+', '', name)
    name = re.sub(r'\s*-\s*[Ee]p\s*\d+', '', name)
    return name.strip()

df['name_pattern'] = df['name'].apply(normalize_name)
df_deduped = df.drop_duplicates(subset=['name_pattern', 'label'])

print("After dedup:")
print(df_deduped['label'].value_counts())

# Step 3: Cap only Others
TARGET_OTHERS = 300
balanced = []
for label, group in df_deduped.groupby('label'):
    if label == 'Others' and len(group) > TARGET_OTHERS:
        balanced.append(group.sample(n=TARGET_OTHERS, random_state=42))
    else:
        balanced.append(group)

df_final = pd.concat(balanced).sample(frac=1, random_state=42).reset_index(drop=True)

# Step 4: Create text feature
df_final['text'] = (
    df_final['name'].fillna('') + ' ' +
    df_final['content'].fillna('')
).str.strip()

# Step 5: Save
df_final[['text', 'name', 'content', 'channel_name', 'begin_time', 'label']]\
    .to_csv('training_final.csv', index=False, encoding='utf-8-sig')

print("\nFinal distribution:")
print(df_final['label'].value_counts())
print(f"\nTotal: {len(df_final)}")