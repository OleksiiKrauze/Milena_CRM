"""
Script to generate VAPID keys for Web Push notifications
"""
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

# Generate private key
private_key = ec.generate_private_key(ec.SECP256R1())

# Get public key
public_key = private_key.public_key()

# Serialize private key
private_bytes = private_key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption()
)

# Serialize public key (uncompressed format for VAPID)
public_bytes = public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)

# Convert to URL-safe base64 (remove padding)
public_key_b64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')

# For private key, we need to extract the raw bytes
private_numbers = private_key.private_numbers()
private_value = private_numbers.private_value
private_bytes_raw = private_value.to_bytes(32, byteorder='big')
private_key_b64 = base64.urlsafe_b64encode(private_bytes_raw).decode('utf-8').rstrip('=')

print("VAPID_PUBLIC_KEY=" + public_key_b64)
print("VAPID_PRIVATE_KEY=" + private_key_b64)
