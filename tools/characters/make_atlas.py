# Shared 1024 atlas for the wardrobe shader: neutralised skin detail (male / female), hair strand detail, eye.
# Skin is divided by its own mean so the shader's skin-tone tint sets the colour; lips/cheek variation stays.
import sys, numpy as np
from PIL import Image
T = '/tmp/ubc/Universal Base Characters[Standard]/Base Characters/Textures/'
out = sys.argv[1]
A = np.full((1024, 1024, 3), 255, np.float32)
def neutral(f, size, gain):
    im = np.asarray(Image.open(T + f).convert('RGB').resize((size, size), Image.LANCZOS), np.float32)
    lum = im.mean(axis=2, keepdims=True); mask = (np.abs(im[..., :1] - im[..., 2:3]) > 12)   # skin pixels (warm); grey = underwear
    m = im[mask[..., 0]].mean(axis=0)
    n = im / m * gain                      # 1.0 -> 0.8 * 255 => shader multiplies by 1.25
    n = np.where(mask, n, gain)            # grey underwear islands -> plain mid (always under clothes)
    return np.clip(n * 255, 0, 255)
A[0:512, 0:512] = neutral('T_Superhero_Male_Ligh.png', 512, 0.8)
A[0:512, 512:1024] = neutral('T_Superhero_Female_Light_BaseColor.png', 512, 0.8)
def gray(f, size):
    im = np.asarray(Image.open(T + f).convert('L').resize((size, size), Image.LANCZOS), np.float32)
    im = (im - im.mean()) / (im.std() + 1e-3) * 0.16 + 0.8   # strand shading around 0.8
    return np.clip(im * 255, 0, 255)[..., None].repeat(3, 2)
A[512:1024, 0:512] = gray('T_Hair_1_BaseColor.png', 512)
A[512:768, 512:768] = gray('T_Hair_2_BaseColor.png', 256)
eye = np.asarray(Image.open(T + 'T_Eye_Brown.png').convert('RGB').resize((128, 128), Image.LANCZOS), np.float32)
A[512:640, 768:896] = eye
Image.fromarray(A.astype(np.uint8)).save(out)
print('atlas', out)
