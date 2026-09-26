import sys
from PIL import Image

def crop_transparent(input_path, output_path, padding_percent=0.1):
    img = Image.open(input_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    bbox = img.getbbox()
    if bbox:
        # Crop to the exact contents
        cropped = img.crop(bbox)
        
        # Add a little padding to the cropped image
        width, height = cropped.size
        pad_w = int(width * padding_percent)
        pad_h = int(height * padding_percent)
        
        new_width = width + 2 * pad_w
        new_height = height + 2 * pad_h
        
        # Make a square image to fit Android circle correctly
        max_dim = max(new_width, new_height)
        
        # Create new transparent square image
        final_img = Image.new('RGBA', (max_dim, max_dim), (0, 0, 0, 0))
        
        # Paste the cropped image in the center
        paste_x = (max_dim - width) // 2
        paste_y = (max_dim - height) // 2
        final_img.paste(cropped, (paste_x, paste_y))
        
        final_img.save(output_path)
        print("Successfully cropped and padded the image to:", output_path)
    else:
        print("Image is completely transparent or couldn't get bounding box")

if __name__ == "__main__":
    crop_transparent("assets/logonobg.png", "assets/splash_logonobg.png")
