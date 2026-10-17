# Shared 512 atlas for the wardrobe shader: neutralised skin detail (male / female), hair strand detail, eye.
# Skin is divided by its own mean so the shader's skin-tone tint sets the colour; lips/cheek variation stays.
import sys, numpy as np
from PIL import Image
T = '/tmp/ubc/Universal Base Characters[Standard]/Base Characters/Textures/'
out = sys.argv[1]
A = np.full((512, 512, 3), 255, np.float32)
def neutral(f, size, gain):
    im = np.asarray(Image.open(T + f).convert('RGB').resize((size, size), Image.LANCZOS), np.float32)
    lum = im.mean(axis=2, keepdims=True); mask = (np.abs(im[..., :1] - im[..., 2:3]) > 12)   # skin pixels (warm); grey = underwear
    m = im[mask[..., 0]].mean(axis=0)
    n = im / m * gain                      # 1.0 -> 0.8 * 255 => shader multiplies by 1.25
    n = np.where(mask, n, gain)            # grey underwear islands -> plain mid (always under clothes)
    return np.clip(n * 255, 0, 255)
A[0:256, 0:256] = neutral('T_Superhero_Male_Ligh.png', 256, 0.8)
A[0:256, 256:512] = neutral('T_Superhero_Female_Light_BaseColor.png', 256, 0.8)
def gray(f, size):
    im = np.asarray(Image.open(T + f).convert('L').resize((size, size), Image.LANCZOS), np.float32)
    im = (im - im.mean()) / (im.std() + 1e-3) * 0.16 + 0.8   # strand shading around 0.8
    return np.clip(im * 255, 0, 255)[..., None].repeat(3, 2)
A[256:512, 0:256] = gray('T_Hair_1_BaseColor.png', 256)
A[256:384, 256:384] = gray('T_Hair_2_BaseColor.png', 128)
eye = np.asarray(Image.open(T + 'T_Eye_Brown.png').convert('RGB').resize((64, 64), Image.LANCZOS), np.float32)
A[256:320, 384:448] = eye
Image.fromarray(A.astype(np.uint8)).save(out)
print('atlas', out)
