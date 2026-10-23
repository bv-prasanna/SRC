package in.srcenterprises.api;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
@Entity @Table(name="media_content")
public class MediaContent {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @NotBlank @Size(max=120) public String title;
 @NotBlank @Size(max=30) public String type;
 @NotBlank @Size(max=1000) public String url;
 @Size(max=100) public String category;
 @Size(max=500) public String subtitle;
 @NotNull public Boolean published=false;
 @Version public Long version;
}